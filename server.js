/**
 * Server Principal - Shape Mestre
 * Node.js + Express API + Static PWA Server
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Garantir carregamento robusto das chaves mesmo se o Docker Swarm passar variável vazia
if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_API_KEY.trim()) {
    const envCandidates = [
        path.join(__dirname, '.env'),
        path.join('/app', '.env'),
        path.join('/var/www/shapemestre', '.env'),
        path.join(__dirname, '..', '.env')
    ];
    for (const p of envCandidates) {
        if (fs.existsSync(p)) {
            require('dotenv').config({ path: p, override: true });
            if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
                console.log('✅ Chaves de IA carregadas de:', p);
                break;
            }
        }
    }
}

const express = require('express');
const cors = require('cors');
const multer = require('multer');

// Serviços internos
const { askAI, analyzeMealPhoto } = require('./services/aiService');
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
let webpDirIndex = null;

function cleanKey(str) {
    return (str || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function repairEncoding(str) {
    if (!str) return '';
    try {
        const fixed = Buffer.from(str, 'binary').toString('utf-8');
        if (fixed && !fixed.includes('\ufffd')) return fixed;
    } catch (e) {}
    return str;
}

function buildWebpIndex() {
    if (webpDirIndex) return webpDirIndex;
    webpDirIndex = new Map();
    if (!fs.existsSync(webpLocalDir)) return webpDirIndex;

    try {
        const entries = fs.readdirSync(webpLocalDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.webp')) continue;
            const fullPath = path.join(webpLocalDir, entry.name);
            const base = entry.name.replace(/\.webp$/i, '');
            
            const k1 = cleanKey(base);
            const k2 = cleanKey(repairEncoding(base));
            webpDirIndex.set(k1, fullPath);
            webpDirIndex.set(k2, fullPath);

            const k1NoNum = k1.replace(/\d+$/, '');
            const k2NoNum = k2.replace(/\d+$/, '');
            if (!webpDirIndex.has(k1NoNum)) webpDirIndex.set(k1NoNum, fullPath);
            if (!webpDirIndex.has(k2NoNum)) webpDirIndex.set(k2NoNum, fullPath);
        }
    } catch (e) {
        console.warn('Aviso ao indexar webpLocalDir:', e.message);
    }
    return webpDirIndex;
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
                    const cleanName1 = cleanKey(entry.name).replace(new RegExp(`${ext}$`), '');
                    const cleanName2 = cleanKey(repairEncoding(entry.name)).replace(new RegExp(`${ext}$`), '');
                    if (cleanName1 === cleanTarget || cleanName2 === cleanTarget) {
                        cacheMap.set(cleanTarget, fullPath);
                        return fullPath;
                    }
                }
            }
        } catch (e) {}
    }
    return null;
}

// 1. Rota de WebP de alta velocidade com Cache Permanente no Navegador e Resolução O(1)
app.get('/assets/webp/*', (req, res, next) => {
    const rawParam = req.params[0] || '';
    const filename = path.basename(rawParam);
    if (!filename) return next();

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // 1. Busca exata no diretório webp
    const exactLocal = path.join(webpLocalDir, rawParam);
    if (fs.existsSync(exactLocal) && fs.statSync(exactLocal).isFile()) {
        return res.sendFile(exactLocal);
    }

    // 2. Busca indexada ultra-rápida O(1) tolerante a acentos e encoding Linux/Windows
    const index = buildWebpIndex();
    const targetBase = filename.replace(/\.webp$/i, '');
    const kTarget = cleanKey(targetBase);
    const kRepaired = cleanKey(repairEncoding(targetBase));

    const matchedPath = index.get(kTarget) 
                     || index.get(kRepaired) 
                     || index.get(kTarget.replace(/\d+$/, '')) 
                     || index.get(kRepaired.replace(/\d+$/, ''));

    if (matchedPath && fs.existsSync(matchedPath)) {
        return res.sendFile(matchedPath);
    }

    // 3. Fallback recursivo caso esteja em subdiretório
    const foundWebp = findFileRecursively(webpLocalDir, filename, 'webp', webpSearchCache);
    if (foundWebp) {
        return res.sendFile(foundWebp);
    }

    // 4. Fallback transparente: se não houver webp, tenta achar o GIF correspondente
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

app.get('/api/cinesiologia', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'data', 'cinesiologia.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Falha ao carregar fichas de cinesiologia', details: err.message });
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
// ROTAS DE NUTRIÇÃO (TABELA TACO & VISÃO IA POR FOTO)
// ----------------------------------------------------

let tacoData = [];
try {
    const tacoPath = path.join(__dirname, 'data', 'taco.json');
    if (fs.existsSync(tacoPath)) {
        tacoData = JSON.parse(fs.readFileSync(tacoPath, 'utf8'));
        console.log(`✅ Tabela TACO carregada: ${tacoData.length} alimentos brasileiros.`);
    }
} catch (e) {
    console.warn('⚠️ Não foi possível carregar taco.json no boot:', e.message);
}

/**
 * GET /api/nutrition/taco
 * Busca instantânea no catálogo brasileiro de alimentos (Tabela TACO)
 */
app.get('/api/nutrition/taco', (req, res) => {
    try {
        const query = (req.query.q || '').trim();
        const category = (req.query.category || '').trim();
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

        if (!tacoData || tacoData.length === 0) {
            const tacoPath = path.join(__dirname, 'data', 'taco.json');
            if (fs.existsSync(tacoPath)) {
                tacoData = JSON.parse(fs.readFileSync(tacoPath, 'utf8'));
            }
        }

        if (!query && !category) {
            return res.json(tacoData.slice(0, limit));
        }

        const normQuery = cleanKey(query);
        const normCat = cleanKey(category);

        const filtered = tacoData.filter(item => {
            let matchesQuery = true;
            let matchesCat = true;

            if (normQuery) {
                const normName = cleanKey(item.nome);
                matchesQuery = normName.includes(normQuery);
            }

            if (normCat) {
                const itemCat = cleanKey(item.categoria);
                matchesCat = itemCat.includes(normCat);
            }

            return matchesQuery && matchesCat;
        });

        res.json(filtered.slice(0, limit));
    } catch (err) {
        res.status(500).json({ error: 'Erro ao pesquisar na Tabela TACO', details: err.message });
    }
});

/**
 * GET /api/nutrition/taco/:id
 * Retorna detalhes completos de um alimento por ID
 */
app.get('/api/nutrition/taco/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const food = tacoData.find(f => f.id === id);
        if (!food) {
            return res.status(404).json({ error: 'Alimento não encontrado na Tabela TACO.' });
        }
        res.json(food);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar alimento', details: err.message });
    }
});

/**
 * POST /api/nutrition/analyze-meal
 * Analisa foto de refeição via IA de visão com Structured Output JSON
 */
app.post('/api/nutrition/analyze-meal', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Arquivo de imagem não enviado.' });
        }

        const mealType = req.body.mealType || 'Almoço';
        const notes = req.body.notes || '';
        const base64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype || 'image/jpeg';

        console.log(`📸 Analisando foto de refeição [${mealType}] (${req.file.size} bytes)...`);

        const analysis = await analyzeMealPhoto({
            imageBase64: base64,
            mimeType,
            mealType,
            userNotes: notes
        });

        res.json({
            success: true,
            meal: analysis
        });
    } catch (err) {
        console.error('❌ Erro na análise de refeição:', err.message);
        res.status(500).json({
            error: 'Falha na análise nutricional da foto',
            details: err.message
        });
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
