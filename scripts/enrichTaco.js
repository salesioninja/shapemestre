/**
 * enrichTaco.js - Script CLI de Enriquecimento Nutricional em Lote (Shape Mestre)
 * Lê alimentos da Tabela TACO sem benefícios, consulta a IA em lotes e salva progressivamente.
 * 
 * Uso:
 *   node scripts/enrichTaco.js
 *   node scripts/enrichTaco.js --limit 50 --batch 10
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { askAI } = require('../services/aiService');

const TACO_PATH = path.join(__dirname, '..', 'data', 'taco.json');
const TACO_PUBLIC_PATH = path.join(__dirname, '..', 'public', 'data', 'taco.json');

// Parse flags
const args = process.argv.slice(2);
let maxToProcess = Infinity;
let batchSize = 10;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) maxToProcess = parseInt(args[i + 1], 10);
    if (args[i] === '--batch' && args[i + 1]) batchSize = parseInt(args[i + 1], 10);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    console.log('🥗 Shape Mestre - Enriquecedor de Tabela TACO com IA');
    console.log('====================================================');

    if (!fs.existsSync(TACO_PATH)) {
        console.error('❌ Arquivo taco.json não encontrado em data/taco.json');
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(TACO_PATH, 'utf-8'));
    const pending = data.filter(item => !item.beneficios || item.beneficios.trim() === '');

    console.log(`📊 Total no catálogo: ${data.length} alimentos`);
    console.log(`✅ Já enriquecidos: ${data.length - pending.length}`);
    console.log(`⏳ Pendentes: ${pending.length}`);

    if (pending.length === 0) {
        console.log('🎉 Todos os alimentos já possuem benefícios cadastrados!');
        process.exit(0);
    }

    const toProcess = pending.slice(0, maxToProcess);
    console.log(`🚀 Iniciando enriquecimento de ${toProcess.length} itens (Lotes de ${batchSize})...\n`);

    let processedCount = 0;

    for (let i = 0; i < toProcess.length; i += batchSize) {
        const batch = toProcess.slice(i, i + batchSize);
        console.log(`⏳ Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(toProcess.length / batchSize)} (${batch.length} alimentos)...`);

        const prompt = `Você é um especialista em nutrição clínica e esportiva brasileira.
Analise a lista de alimentos abaixo da Tabela TACO (com calorias e macronutrientes por 100g) e gere, para CADA UM deles:
1. "beneficios": texto conciso (1 a 2 frases) explicando os principais benefícios à saúde, performance esportiva ou digestão com base nos nutrientes.
2. "dica_consumo": uma recomendação prática de preparo, melhor horário de consumo ou combinação inteligente de alimentos no contexto brasileiro.

Alimentos do lote:
${batch.map(item => `- ID ${item.id}: "${item.nome}" (${item.categoria}) | ${item.calorias_kcal} kcal, P:${item.proteinas_g}g, C:${item.carboidratos_g}g, G:${item.gorduras_g}g, Fibras:${item.fibras_g}g`).join('\n')}

IMPORTANTE: Responda ESTRITAMENTE em formato JSON puro (array de objetos), sem blocos de markdown e sem explicações externas:
[
  {
    "id": 1,
    "beneficios": "Texto explicativo...",
    "dica_consumo": "Dica prática..."
  }
]`;

        try {
            const rawResponse = await askAI({
                prompt,
                agent: 'mia',
                temperature: 0.3
            });

            // Extrair JSON
            let cleaned = rawResponse.trim();
            if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');

            const results = JSON.parse(cleaned);

            if (Array.isArray(results)) {
                results.forEach(res => {
                    const target = data.find(item => item.id === res.id);
                    if (target) {
                        target.beneficios = res.beneficios || target.beneficios;
                        target.dica_consumo = res.dica_consumo || target.dica_consumo;
                    }
                });

                // Salvar após cada lote (Checkpoint seguro)
                fs.writeFileSync(TACO_PATH, JSON.stringify(data, null, 2), 'utf-8');
                if (fs.existsSync(path.dirname(TACO_PUBLIC_PATH))) {
                    fs.writeFileSync(TACO_PUBLIC_PATH, JSON.stringify(data, null, 2), 'utf-8');
                }

                processedCount += batch.length;
                console.log(`   ✅ Lote gravado com sucesso! Progresso: ${processedCount}/${toProcess.length}`);
            } else {
                console.warn('   ⚠️ Resposta da IA não retornou um array esperado. Pulando lote.');
            }

            // Intervalo de cortesia para evitar rate-limit
            await sleep(1500);

        } catch (err) {
            console.error(`   ❌ Erro ao processar lote: ${err.message}`);
            console.log('   ⏸️ Aguardando 5 segundos antes de continuar...');
            await sleep(5000);
        }
    }

    console.log('\n====================================================');
    console.log(`🏁 Concluído! ${processedCount} alimentos enriquecidos e salvos.`);
}

main().catch(console.error);
