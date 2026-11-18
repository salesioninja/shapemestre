/**
 * Server Principal - Shape Mestre
 * Node.js + Express API + Static PWA Server
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Serviços internos
const { askAI } = require('./services/aiService');
const { transcribeAudio } = require('./services/whisperService');
const { sendWhatsAppText, sendWhatsAppMedia, parseEvolutionWebhook } = require('./services/evolutionService');
const { saveChatMessage, getChatHistory } = require('./services/dbService');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar upload em memória com Multer (para áudios e fotos de refeições)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // até 25MB
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Servir arquivos estáticos do Frontend PWA
app.use(express.static(path.join(__dirname, 'public')));

// Diretórios de mídias dos exercícios
const gifsLocalDir = path.join(__dirname, 'public', 'assets', 'gifs');
const webpLocalDir = path.join(__dirname, 'public', 'assets', 'webp');
const gifsFallbackDir = path.join(__dirname, '..', 'TODOS OS GIFS MUSCULAÇÃO');
const gifSearchCache = new Map();
const webpSearchCache = new Map();

function cleanKey(str) {
    return (str || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function findFileRecursively(dir, targetName, ext, cacheMap) {
    if (!fs.existsSync(dir)) return null;
    const cleanTarget = cleanKey(targetName).replace(new RegExp(`${ext}$`), '');

    if (cacheMap.has(cleanTarget)) {
        return cacheMap.get(cleanTarget);
    }

    const stack = [dir];
    while (stack.length > 0) {
        const currentDir = stack.pop();
        try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    stack.push(fullPath);
                } else if (entry.name.toLowerCase().endsWith('.' + ext)) {
                    const cleanName = cleanKey(entry.name).replace(new RegExp(`${ext}$`), '');
                    if (cleanName === cleanTarget) {
                        cacheMap.set(cleanTarget, fullPath);
                        return fullPath;
                    }
                }
            }
        } catch (e) {}
    }
    return null;
}

// 1. Rota de WebP de alta velocidade com Cache Permanente no Navegador
app.get('/assets/webp/*', (req, res, next) => {
    const rawParam = req.params[0] || '';
    const filename = path.basename(rawParam);
    if (!filename) return next();

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // Busca exata no diretório webp
    const exactLocal = path.join(webpLocalDir, rawParam);
    if (fs.existsSync(exactLocal) && fs.statSync(exactLocal).isFile()) {
        return res.sendFile(exactLocal);
    }

    // Busca inteligente com tolerância a acentos e espaços
    const foundWebp = findFileRecursively(webpLocalDir, filename, 'webp', webpSearchCache);
    if (foundWebp) {
        return res.sendFile(foundWebp);
    }

    // Fallback transparente: se não houver webp, tenta achar o GIF correspondente
    const gifName = filename.replace(/\.webp$/i, '.gif');
    const fallbackGif = findFileRecursively(gifsLocalDir, gifName, 'gif', gifSearchCache) 
                     || (fs.existsSync(gifsFallbackDir) ? findFileRecursively(gifsFallbackDir, gifName, 'gif', gifSearchCache) : null);
    if (fallbackGif) {
        return res.sendFile(fallbackGif);
    }

    next();
});

// 2. Rota de GIFs com negociação automática para WebP e Cache Agressivo
app.get('/assets/gifs/*', (req, res, next) => {
    const rawParam = req.params[0] || '';
    const filename = path.basename(rawParam);
    if (!filename) return next();

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // Se existir a versão WebP otimizada equivalente, serve o WebP automaticamente
    const baseName = filename.replace(/\.gif$/i, '');
    const webpFile = path.join(webpLocalDir, `${baseName}.webp`);
    if (fs.existsSync(webpFile)) {
        return res.sendFile(webpFile);
    }
    const smartWebp = findFileRecursively(webpLocalDir, baseName, 'webp', webpSearchCache);
    if (smartWebp) {
        return res.sendFile(smartWebp);
    }

    // 1. Verificar se existe exatamente no caminho pedido dentro de public/assets/gifs
    const exactLocal = path.join(gifsLocalDir, rawParam);
    if (fs.existsSync(exactLocal) && fs.statSync(exactLocal).isFile()) {
        return res.sendFile(exactLocal);
    }

    // 2. Procurar recursivamente em public/assets/gifs
    let found = findFileRecursively(gifsLocalDir, filename, 'gif', gifSearchCache);

    // 3. Fallback em dev local
    if (!found && fs.existsSync(gifsFallbackDir)) {
        found = findFileRecursively(gifsFallbackDir, filename, 'gif', gifSearchCache);
    }

    if (found) {
        return res.sendFile(found);
    }

    next();
});

// ----------------------------------------------------
// ROTAS DE DADOS (TREINOS, EXERCÍCIOS, RECEITAS)
// ----------------------------------------------------

app.get('/api/trainings', (req, res) => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'data', 'trainings.json'), 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: 'Falha ao carregar treinos', details: err.message });
    }
});

app.get('/api/exercises', (req, res) => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'data', 'exercises.json'), 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: 'Falha ao carregar exercícios', details: err.message });
    }
});

app.get('/api/recipes', (req, res) => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'data', 'recipes.json'), 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ error: 'Falha ao carregar receitas', details: err.message });
    }
});

// ----------------------------------------------------
// ROTAS DE CHAT IA (MIA NUTRI & PERSONAL TRAINER)
// ----------------------------------------------------

/**
 * Chat em texto (Gemini 2.5 Flash / OpenAI)
 */
app.post('/api/chat', async (req, res) => {
    try {
        const { prompt, agent = 'personal', sessionKey = 'web-user' } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'O prompt é obrigatório.' });
        }

        const history = await getChatHistory(sessionKey, 8);
        await saveChatMessage(sessionKey, 'user', prompt, agent);

        const responseText = await askAI({
            prompt,
            history,
            agent
        });

        await saveChatMessage(sessionKey, 'assistant', responseText, agent);

        res.json({
            success: true,
            agent,
            response: responseText
        });
    } catch (error) {
        console.error('Erro no /api/chat:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao processar IA' });
    }
});

/**
 * Envio de áudio (microfone do site) -> Whisper -> IA
 */
app.post('/api/chat/audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Arquivo de áudio não enviado.' });
        }

        const agent = req.body.agent || 'personal';
        const sessionKey = req.body.sessionKey || 'web-user';

        // 1. Transcrever áudio com OpenAI Whisper
        let transcript = '';
        try {
            transcript = await transcribeAudio(req.file.buffer, req.file.originalname || 'audio.webm');
        } catch (whisperErr) {
            console.warn('Whisper falhou ou chave ausente:', whisperErr.message);
            transcript = '[Áudio recebido, mas Whisper não configurado no servidor]';
        }

        // 2. Enviar transcrição para a IA
        const history = await getChatHistory(sessionKey, 8);
        await saveChatMessage(sessionKey, 'user', `(Mensagem de Áudio): ${transcript}`, agent);

        const responseText = await askAI({
            prompt: transcript,
            history,
            agent
        });

        await saveChatMessage(sessionKey, 'assistant', responseText, agent);

        res.json({
            success: true,
            transcript,
            response: responseText
        });
    } catch (error) {
        console.error('Erro no /api/chat/audio:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Análise de imagem (foto de prato ou postura) via Gemini Visão
 */
app.post('/api/chat/image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Arquivo de imagem não enviado.' });
        }

        const agent = req.body.agent || 'mia';
        const sessionKey = req.body.sessionKey || 'web-user';
        const prompt = req.body.prompt || (agent === 'mia' 
            ? 'Analise esta refeição: identifique os alimentos visíveis, estime as quantidades em gramas e forneça a tabela aproximada de calorias, proteínas, carboidratos e gorduras.' 
            : 'Analise esta foto de postura/exercício e dê orientações biomecânicas de correção.');

        const base64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype || 'image/jpeg';

        const history = await getChatHistory(sessionKey, 4);
        const responseText = await askAI({
            prompt,
            history,
            agent,
            imageBase64: base64,
            mimeType
        });

        await saveChatMessage(sessionKey, 'user', `[Foto enviada]: ${prompt}`, agent);
        await saveChatMessage(sessionKey, 'assistant', responseText, agent);

        res.json({
            success: true,
            agent,
            response: responseText
        });
    } catch (error) {
        console.error('Erro no /api/chat/image:', error);
        res.status(500).json({ error: error.message });
    }
});

// ----------------------------------------------------
// ROTAS DE INTEGRAÇÃO COM WHATSAPP (EVOLUTION API)
// ----------------------------------------------------

/**
 * Envia uma ficha de treino ou cardápio do App para o WhatsApp do aluno
 */
app.post('/api/whatsapp/send-plan', async (req, res) => {
    try {
        const { phone, planText, title = 'Seu Treino Shape Mestre' } = req.body;
        if (!phone || !planText) {
            return res.status(400).json({ error: 'Telefone e conteúdo do plano são obrigatórios.' });
        }

        const message = planText.includes('SHAPE MESTRE') 
            ? planText 
            : `🏋️‍♂️ *${title.toUpperCase()}*\n\n${planText}\n\n_Enviado pelo seu aplicativo Shape Mestre_ 🔥`;

        const result = await sendWhatsAppText(phone, message);

        res.json({ success: result.success, details: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Webhook recebido da Evolution API quando o aluno envia mensagem no WhatsApp
 */
app.post('/api/webhook/evolution', async (req, res) => {
    // Responder imediatamente com 200 OK para a Evolution API não reenviar
    res.status(200).json({ received: true });

    try {
        const parsed = parseEvolutionWebhook(req.body);
        if (!parsed || !parsed.text) return;

        console.log(`[WhatsApp Inbound] De: ${parsed.pushName} (${parsed.senderNumber}) - Mensagem: "${parsed.text}"`);

        // Identificar agente: se falar sobre comida/dieta vai para MIA, senão para Personal
        const isNutri = /dieta|comida|caloria|almoço|jantar|café|whey|refeição|comer|nutri/i.test(parsed.text);
        const agent = isNutri ? 'mia' : 'personal';

        const history = await getChatHistory(parsed.senderNumber, 6);
        await saveChatMessage(parsed.senderNumber, 'user', parsed.text, agent);

        const aiReply = await askAI({
            prompt: parsed.text,
            history,
            agent
        });

        await saveChatMessage(parsed.senderNumber, 'assistant', aiReply, agent);

        // Responder o aluno de volta no WhatsApp
        await sendWhatsAppText(parsed.senderNumber, aiReply);
        console.log(`[WhatsApp Outbound] Resposta enviada com sucesso para ${parsed.senderNumber}`);
    } catch (err) {
        console.error('[WhatsApp Webhook Erro]:', err.message);
    }
});

// ----------------------------------------------------
// STATUS DO SERVIDOR
// ----------------------------------------------------
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        app: 'Shape Mestre',
        domain: 'shapemestre.acessaronline.com.br',
        time: new Date().toISOString()
    });
});

// Redirecionamento SPA (para qualquer rota retornar o index.html)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🔥 SHAPE MESTRE - Servidor Ativo na porta ${PORT}`);
    console.log(`🌐 Acesse localmente: http://localhost:${PORT}`);
    console.log(`🌐 Domínio de Produção: shapemestre.acessaronline.com.br`);
    console.log(`====================================================`);
});
