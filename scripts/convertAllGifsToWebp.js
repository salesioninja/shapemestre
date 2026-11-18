const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const gifsRoot = path.join(__dirname, '..', '..', 'TODOS OS GIFS MUSCULAÇÃO');
const outputDir = path.join(__dirname, '..', 'public', 'assets', 'webp');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 1. Varrer todos os GIFs da pasta recursivamente
function collectGifs(dir, list = []) {
    if (!fs.existsSync(dir)) return list;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectGifs(fullPath, list);
        } else if (entry.name.toLowerCase().endsWith('.gif')) {
            list.push({
                name: entry.name,
                fullPath,
                size: fs.statSync(fullPath).size
            });
        }
    }
    return list;
}

console.log('🔍 Mapeando todos os GIFs em TODOS OS GIFS MUSCULAÇÃO...');
const allGifs = collectGifs(gifsRoot);
console.log(`📦 Encontrados ${allGifs.length} GIFs no total.`);

// Dedup por nome base (caso haja o mesmo arquivo em subpastas)
const uniqueGifsMap = new Map();
allGifs.forEach(g => {
    const baseName = path.parse(g.name).name;
    if (!uniqueGifsMap.has(baseName)) {
        uniqueGifsMap.set(baseName, g);
    }
});
const queue = Array.from(uniqueGifsMap.values());
console.log(`📋 Total único a converter: ${queue.length} exercícios.`);

const CONCURRENCY = Math.min(6, os.cpus().length || 4);
console.log(`⚡ Usando ${CONCURRENCY} processos paralelos com aceleração multithread.\n`);

let completed = 0;
let skipped = 0;
let totalOriginalBytes = 0;
let totalNewBytes = 0;
const startTime = Date.now();

function convertOne(item) {
    return new Promise((resolve) => {
        const baseName = path.parse(item.name).name;
        const outPath = path.join(outputDir, `${baseName}.webp`);

        // Se já foi convertido com sucesso anteriormente, pula para economizar tempo
        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1024) {
            skipped++;
            completed++;
            const newSize = fs.statSync(outPath).size;
            totalOriginalBytes += item.size;
            totalNewBytes += newSize;
            return resolve();
        }

        // Executar ffmpeg via child_process spawn
        const args = [
            '-y',
            '-i', item.fullPath,
            '-vf', "scale='min(480,iw)':-1:flags=lanczos",
            '-vcodec', 'libwebp',
            '-lossless', '0',
            '-compression_level', '4',
            '-q:v', '70',
            '-loop', '0',
            outPath
        ];

        const proc = spawn('ffmpeg', args, { stdio: 'ignore' });

        proc.on('close', (code) => {
            completed++;
            if (code === 0 && fs.existsSync(outPath)) {
                const newSize = fs.statSync(outPath).size;
                totalOriginalBytes += item.size;
                totalNewBytes += newSize;
            } else {
                console.warn(`⚠️ Aviso: falha ao converter ${item.name}`);
            }

            if (completed % 25 === 0 || completed === queue.length) {
                const pct = ((completed / queue.length) * 100).toFixed(1);
                const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
                console.log(`⏳ Progresso: [${completed}/${queue.length}] ${pct}% | Tempo: ${elapsedMin} min | Pulados: ${skipped}`);
            }

            resolve();
        });

        proc.on('error', (err) => {
            console.error(`Erro no processo ffmpeg para ${item.name}:`, err.message);
            completed++;
            resolve();
        });
    });
}

async function runWorker(workerId) {
    while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        await convertOne(item);
    }
}

async function main() {
    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push(runWorker(i));
    }
    await Promise.all(workers);

    const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(1);
    const origMB = (totalOriginalBytes / (1024 * 1024)).toFixed(1);
    const newMB = (totalNewBytes / (1024 * 1024)).toFixed(1);
    const reduction = totalOriginalBytes > 0 ? ((1 - (totalNewBytes / totalOriginalBytes)) * 100).toFixed(1) : 0;

    console.log('\n=============================================');
    console.log('🎉 CONVERSÃO CONCLUÍDA COM SUCESSO!');
    console.log('=============================================');
    console.log(`✅ Total de exercícios processados: ${completed}`);
    console.log(`📦 Peso original antes (GIFs): ${origMB} MB (${(origMB/1024).toFixed(2)} GB)`);
    console.log(`✨ Novo peso final (WebP): ${newMB} MB (${(newMB/1024).toFixed(2)} GB)`);
    console.log(`🚀 Redução total de tamanho: ${reduction}% de economia!`);
    console.log(`⏱️ Tempo total gasto: ${totalTimeSec} segundos (~${(totalTimeSec/60).toFixed(1)} minutos)`);
    console.log(`📂 Pasta com os arquivos otimizados: ${outputDir}`);
    console.log('=============================================\n');
}

main().catch(console.error);
