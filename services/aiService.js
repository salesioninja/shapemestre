/**
 * AI Service - Shape Mestre
 * Suporte nativo a Google Gemini 2.5/1.5 Flash e OpenAI GPT-4o-mini
 */

const SYSTEM_PROMPTS = {
    mia: `Você é a MIA (Mestra de Inteligência Nutricional), a nutricionista oficial do aplicativo Shape Mestre.
Sua missão é ajudar os usuários a atingirem seus objetivos físicos (emagrecimento, hipertrofia, definição, saúde) com orientação nutricional prática, humanizada e baseada em ciência.
Diretrizes:
- Use alimentos comuns e acessíveis no Brasil (arroz, feijão, frango, ovos, aveia, banana, azeite, etc.).
- Sempre calcule e estime calorias e macronutrientes (proteínas, carboidratos e gorduras) quando o usuário perguntar sobre refeições.
- Se o usuário enviar fotos de pratos, descreva os alimentos identificados e estime a tabela de macros.
- Seja motivadora, clara, use formatação limpa com tópicos e emojis moderados.
- Incentive o consumo adequado de água (35ml a 40ml por kg de peso corporal).
- Se o usuário pedir um plano alimentar, pergunte a idade, peso, altura, objetivo e rotina de treino antes de calcular a taxa metabólica basal.`,

    personal: `Você é o Personal Trainer IA oficial do aplicativo Shape Mestre.
Sua missão é montar rotinas de treino inteligentes, tirar dúvidas de biomecânica e garantir a máxima hipertrofia e definição muscular com segurança.
Diretrizes:
- Domina divisões de treino (Full Body, AB, ABC, ABCDE, Push/Pull/Legs).
- Explica a execução correta dos exercícios, postura da coluna e ângulos de articulações.
- Se o usuário relatar dores anormais nas articulações (ombro, lombar, joelho), oriente a interrupção imediata do exercício e sugira substitutos biomecanicamente mais seguros.
- Orienta tempo de descanso entre séries (geralmente 60s a 120s para hipertrofia, 2 a 3 min para força pura).
- Responda de forma enérgica, motivadora e focada em resultados reais.`
};

/**
 * Chama o Google Gemini (Gemini 2.5 Flash / 1.5 Flash)
 */
async function callGemini({ prompt, history = [], agent = 'personal', imageBase64 = null, mimeType = 'image/jpeg', jsonMode = false }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY não configurada no servidor.');
    }

    const systemInstruction = SYSTEM_PROMPTS[agent] || SYSTEM_PROMPTS.personal;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const contents = [];

    history.forEach(msg => {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        });
    });

    const currentParts = [];
    if (imageBase64) {
        currentParts.push({
            inline_data: {
                mime_type: mimeType,
                data: imageBase64
            }
        });
    }
    currentParts.push({ text: prompt });
    contents.push({ role: 'user', parts: currentParts });

    const generationConfig = {
        temperature: jsonMode ? 0.2 : 0.7,
        maxOutputTokens: 8192
    };

    if (jsonMode) {
        generationConfig.responseMimeType = "application/json";
    }

    const payload = {
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        contents: contents,
        generationConfig: generationConfig
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na API do Gemini (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map(p => p.text).join('') || 'Desculpe, não consegui gerar uma resposta no momento.';
    return text;
}

/**
 * Chama a OpenAI (GPT-4o-mini / GPT-4o)
 */
async function callOpenAI({ prompt, history = [], agent = 'personal', imageBase64 = null, jsonMode = false }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY não configurada no servidor.');
    }

    const systemInstruction = SYSTEM_PROMPTS[agent] || SYSTEM_PROMPTS.personal;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const url = 'https://api.openai.com/v1/chat/completions';

    const messages = [
        { role: 'system', content: systemInstruction }
    ];

    history.forEach(msg => {
        messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
        });
    });

    if (imageBase64) {
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:image/jpeg;base64,${imageBase64}`
                    }
                }
            ]
        });
    } else {
        messages.push({ role: 'user', content: prompt });
    }

    const payload = {
        model: model,
        messages: messages,
        temperature: jsonMode ? 0.2 : 0.7,
        max_tokens: 4000
    };

    if (jsonMode) {
        payload.response_format = { type: "json_object" };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na API OpenAI (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Sem resposta da IA.';
}

/**
 * Roteador Inteligente de IA:
 * Prefere Gemini para velocidade e análise de imagens, com fallback para OpenAI.
 */
async function askAI(options) {
    const provider = process.env.DEFAULT_AI_PROVIDER || 'gemini';
    
    if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
        try {
            return await callGemini(options);
        } catch (err) {
            console.warn('Falha na chamada Gemini, tentando OpenAI fallback:', err.message);
            if (process.env.OPENAI_API_KEY) {
                return await callOpenAI(options);
            }
            throw err;
        }
    } else if (process.env.OPENAI_API_KEY) {
        return await callOpenAI(options);
    } else if (process.env.GEMINI_API_KEY) {
        return await callGemini(options);
    } else {
        const agentName = options.agent === 'mia' ? 'MIA Nutri' : 'Personal Trainer';
        return `[Modo Demonstração ${agentName}]: Configure suas chaves GEMINI_API_KEY ou OPENAI_API_KEY no arquivo .env da aplicação.`;
    }
}

function safeParseJSON(str) {
    if (!str) return null;
    let text = str.trim();
    if (text.startsWith('```json')) text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    else if (text.startsWith('```')) text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');

    try { return JSON.parse(text); } catch (e) {}

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)); } catch (e) {}
    }
    return null;
}

/**
 * Análise Nutricional Estruturada por Foto de Prato (Vision IA com Structured JSON)
 * Retorna alimentos identificados, porções em gramas, medidas caseiras, macros e benefícios.
 */
async function analyzeMealPhoto({ imageBase64, mimeType = 'image/jpeg', mealType = 'Almoço', userNotes = '' }) {
    const prompt = `Atue como nutricionista clínica e esportiva de alta precisão (MIA Nutri - Shape Mestre).
Analise a fotografia do prato/refeição enviada. Identifique detalhadamente cada alimento visível no prato e estime com rigor científico o peso e os macronutrientes.

Tipo de refeição informado pelo usuário: "${mealType}".
Notas adicionais do usuário (ingredientes ou detalhes não visíveis): "${userNotes || 'Nenhuma'}".

Diretrizes obrigatórias de precisão científica:
1. Decomponha o prato em alimentos individuais específicos da culinária brasileira (ex: Arroz branco cozido, Peito de frango grelhado, Salada de alface e tomate, Biscoito wafer, etc.).
2. Para cada alimento estime a porção em gramas (porcao_estimada_g), a medida caseira brasileira (medida_caseira: ex: "1 filé médio", "3 colheres de sopa", "2 unidades"), proteínas (g), carboidratos (g), gorduras (g) e fibras (g).
3. CÁLCULO DE CALORIAS RIGOROSO (Fórmula de Atwater): calorias_kcal DEVE ser exatamente: (proteinas_g * 4) + (carboidratos_g * 4) + (gorduras_g * 9). As calorias NUNCA podem divergir da soma dos macros.
4. "beneficios": 1 frase curta e direta sobre os benefícios reais do alimento.
5. AVALIAÇÃO DA NUTRI (Em frases curtas e objetivas, NUNCA texto corrido denso):
   - "veredito": Frase curta de impacto com emoji sobre o prato (ex: "⚡ Fonte de energia rápida com moderada densidade calórica").
   - "ponto_atencao": Frase curta com emoji apontando o ponto crítico (ex: "⚠️ Baixo teor proteico e de fibras, gerando menor saciedade").
   - "dica_nutri": Sugestão prática e aplicável para equilibrar (ex: "💡 Combine com 1 dose de whey ou iogurte natural para manter a massa muscular").
6. "confianca": "alta" | "media" | "baixa".
7. REGRAS ANTI-DUPLICAÇÃO E BOM SENSO VISUAL:
   - Nunca duplique a base de carboidratos: se houver uma massa de grãos, escolha apenas UMA opção dominante (ex: ou Arroz OU Cuscuz, NUNCA liste ambos para a mesma porção do prato).
   - Se houver cubos amarelos/alaranjados, identifique apenas um alimento dominante (ex: Manga fresca OU Abóbora, não invente dois alimentos no mesmo espaço).
   - Fatias vermelhas diagonais com pele lisa e sementes são pimentão vermelho ou pimenta doce, não confunda com tomate cereja.

RESPONDA ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "tipo_refeicao": "${mealType}",
  "titulo_prato": "Nome descritivo e apetitoso do prato",
  "alimentos": [
    {
      "nome": "string",
      "porcao_estimada_g": number,
      "medida_caseira": "string",
      "calorias_kcal": number,
      "proteinas_g": number,
      "carboidratos_g": number,
      "gorduras_g": number,
      "fibras_g": number,
      "beneficios": "string curta"
    }
  ],
  "totais": {
    "calorias_kcal": number,
    "proteinas_g": number,
    "carboidratos_g": number,
    "gorduras_g": number,
    "fibras_g": number
  },
  "resumo_prato": "Síntese geral em 1 frase",
  "veredito": "⚡ Frase curta de impacto",
  "ponto_atencao": "⚠️ Ponto de atenção nutricional",
  "dica_nutri": "💡 Sugestão prática da nutricionista",
  "confianca": "alta"
}`;

    const rawResponse = await askAI({
        prompt,
        agent: 'mia',
        imageBase64,
        mimeType,
        jsonMode: true
    });

    try {
        const parsed = safeParseJSON(rawResponse);
        if (!parsed) {
            throw new Error('Falha ao interpretar JSON da IA');
        }

        // Sanitize and ensure totals are mathematically consistent (Atwater: 4 * P + 4 * C + 9 * G)
        if (parsed.alimentos && Array.isArray(parsed.alimentos)) {
            let sumKcal = 0, sumProt = 0, sumCarb = 0, sumFat = 0, sumFib = 0;
            parsed.alimentos.forEach(item => {
                item.porcao_estimada_g = Math.round(Number(item.porcao_estimada_g) || 0);
                item.proteinas_g = Math.round((Number(item.proteinas_g) || 0) * 10) / 10;
                item.carboidratos_g = Math.round((Number(item.carboidratos_g) || 0) * 10) / 10;
                item.gorduras_g = Math.round((Number(item.gorduras_g) || 0) * 10) / 10;
                item.fibras_g = Math.round((Number(item.fibras_g) || 0) * 10) / 10;

                // Força rigor matemático clínico: Kcal = (P * 4) + (C * 4) + (G * 9)
                const atwaterKcal = Math.round((item.proteinas_g * 4) + (item.carboidratos_g * 4) + (item.gorduras_g * 9));
                item.calorias_kcal = atwaterKcal > 0 ? atwaterKcal : Math.round(Number(item.calorias_kcal) || 0);

                sumKcal += item.calorias_kcal;
                sumProt += item.proteinas_g;
                sumCarb += item.carboidratos_g;
                sumFat += item.gorduras_g;
                sumFib += item.fibras_g;
            });

            parsed.totais = {
                calorias_kcal: Math.round(sumKcal),
                proteinas_g: Math.round(sumProt * 10) / 10,
                carboidratos_g: Math.round(sumCarb * 10) / 10,
                gorduras_g: Math.round(sumFat * 10) / 10,
                fibras_g: Math.round(sumFib * 10) / 10
            };
        }

        return parsed;
    } catch (err) {
        console.error('Erro ao fazer parse do JSON da análise nutricional:', err, 'Resposta bruta:', rawResponse);
        throw new Error('A IA não conseguiu estruturar os dados nutricionais da foto. Tente novamente.');
    }
}

module.exports = {
    askAI,
    callGemini,
    callOpenAI,
    analyzeMealPhoto,
    SYSTEM_PROMPTS
};
