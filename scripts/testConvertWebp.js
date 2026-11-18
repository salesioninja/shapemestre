const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const gifsRoot = path.join(__dirname, '..', '..', 'TODOS OS GIFS MUSCULAÇÃO');
const outputDir = path.join(__dirname, '..', 'public', 'assets', 'webp_test');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Encontrar todos os GIFs na pasta
function findGifs(dir, list = []) {
    if (!fs.existsSync(dir)) return list;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            findGifs(fullPath, list);
        } else if (entry.name.toLowerCase().endsWith('.gif')) {
            list.push({ name: entry.name, fullPath });
        }
    }
    return list;
}

console.log('🔍 Varrendo biblioteca de GIFs...');
const allGifs = findGifs(gifsRoot);
console.log(`📦 Encontrados ${allGifs.length} GIFs no total.\n`);

// Selecionar 5 GIFs variados para o teste (incluindo Tríceps Francês e outros)
const sampleTargets = [
    'Tríceps Francês com Halter Bilateral.gif',
    'Tríceps Francês Alternada com Halteres no Banco Inclinado.gif',
    'Tríceps Francês com Faixa Elástica Acima da Cabeça.gif'
];

let selectedSamples = allGifs.filter(g => sampleTargets.includes(g.name));

// Se faltar algum para completar 5, adicionar outros aleatórios
if (selectedSamples.length < 5) {
    const remaining = allGifs.filter(g => !selectedSamples.some(s => s.fullPath === g.fullPath));
    for (const r of remaining) {
        if (selectedSamples.length >= 5) break;
        selectedSamples.push(r);
    }
}

console.log('🚀 Iniciando conversão de teste de 5 GIFs para WebP animado otimizado...\n');

const results = [];

selectedSamples.forEach((sample, index) => {
    const baseName = path.parse(sample.name).name;
    const outPath = path.join(outputDir, `${baseName}.webp`);
    
    const origSizeBytes = fs.statSync(sample.fullPath).size;
    const origSizeMB = (origSizeBytes / (1024 * 1024)).toFixed(2);
    
    const startTime = Date.now();
    
    // Comando FFmpeg otimizado para WebP animado fluido e ultra leve
    // scale='min(480,iw)':-1 redimensiona no máximo para 480px mantendo nitidez retinada para os cards
    const ffmpegCmd = `ffmpeg -y -i "${sample.fullPath}" -vf "scale='min(480,iw)':-1:flags=lanczos" -vcodec libwebp -lossless 0 -compression_level 4 -q:v 70 -loop 0 "${outPath}"`;
    
    try {
        execSync(ffmpegCmd, { stdio: 'ignore' });
        const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
        const newSizeBytes = fs.statSync(outPath).size;
        const newSizeKB = (newSizeBytes / 1024).toFixed(1);
        const reductionPercent = ((1 - (newSizeBytes / origSizeBytes)) * 100).toFixed(1);

        results.push({
            '#': index + 1,
            'Exercício': baseName.length > 35 ? baseName.substring(0, 32) + '...' : baseName,
            'Original (GIF)': `${origSizeMB} MB`,
            'Otimizado (WebP)': `${newSizeKB} KB`,
            'Economia': `${reductionPercent}%`,
            'Tempo': `${elapsedSec}s`
        });
    } catch (err) {
        console.error(`Erro ao converter ${sample.name}:`, err.message);
    }
});

console.table(results);

// Totais comparativos
const totalOriginalBytes = selectedSamples.reduce((acc, s) => acc + fs.statSync(s.fullPath).size, 0);
const totalNewBytes = results.reduce((acc, r, i) => {
    const baseName = path.parse(selectedSamples[i].name).name;
    return acc + fs.statSync(path.join(outputDir, `${baseName}.webp`)).size;
}, 0);

console.log('\n📊 RESUMO GERAL DO TESTE:');
console.log(`- Tamanho total original (5 GIFs): ${(totalOriginalBytes / (1024 * 1024)).toFixed(2)} MB`);
console.log(`- Tamanho total otimizado (5 WebP): ${(totalNewBytes / (1024 * 1024)).toFixed(2)} MB (${(totalNewBytes / 1024).toFixed(1)} KB)`);
console.log(`- Redução total de tráfego/peso: ${((1 - (totalNewBytes / totalOriginalBytes)) * 100).toFixed(1)}% mais leve!`);
console.log(`- Pasta com os testes gerados: ${outputDir}`);
