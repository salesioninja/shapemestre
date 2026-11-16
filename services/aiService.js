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
async function callGemini({ prompt, history = [], agent = 'personal', imageBase64 = null, mimeType = 'image/jpeg' }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY não configurada no servidor.');
    }

    const systemInstruction = SYSTEM_PROMPTS[agent] || SYSTEM_PROMPTS.personal;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Montar histórico de conversação
    const contents = [];

    // Histórico prévio
    history.forEach(msg => {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        });
    });

    // Mensagem atual
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

    const payload = {
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        contents: contents,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500
        }
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
async function callOpenAI({ prompt, history = [], agent = 'personal', imageBase64 = null }) {
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
        temperature: 0.7
    };

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
        // Modo de demonstração / mock local caso nenhuma chave ainda esteja preenchida no .env
        const agentName = options.agent === 'mia' ? 'MIA Nutri' : 'Personal Trainer';
        return `[Modo Demonstração ${agentName}]: Olá! Para ativar minhas respostas completas com inteligência artificial, configure suas chaves GEMINI_API_KEY ou OPENAI_API_KEY no arquivo .env da aplicação.`;
    }
}

module.exports = {
    askAI,
    callGemini,
    callOpenAI,
    SYSTEM_PROMPTS
};
