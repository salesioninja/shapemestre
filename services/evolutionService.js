/**
 * Evolution API Service - Integração Completa com WhatsApp
 * Permite envio de mensagens de texto, mídias e processamento de webhooks
 */

/**
 * Evolution API Service - Integração Completa com WhatsApp
 * Suporta instâncias e chaves de instância da Evolution API v1 e v2
 */

function getCleanBaseUrl() {
    let url = process.env.EVOLUTION_API_URL || '';
    url = url.trim().replace(/\/manager\/?$/, '').replace(/\/+$/, '');
    return url;
}

/**
 * Envia uma mensagem de texto pelo WhatsApp via Evolution API
 */
async function sendWhatsAppText(number, text) {
    const apiUrl = getCleanBaseUrl();
    const apiKey = (process.env.EVOLUTION_API_KEY || '').trim();
    const instance = (process.env.EVOLUTION_INSTANCE || 'Professor').trim();

    if (!apiUrl || !apiKey) {
        console.warn('[Evolution API] URL ou Chave não configuradas no .env');
        return { success: false, message: 'Evolution API não configurada' };
    }

    // Normalizar número (garantir formato DDI 55 + DDD + Número)
    let cleanNumber = number.replace(/\D/g, '');
    if (!cleanNumber.startsWith('55')) {
        cleanNumber = '55' + cleanNumber;
    }

    const endpoint = `${apiUrl}/message/sendText/${instance}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                number: cleanNumber,
                text: text,
                textMessage: {
                    text: text
                }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[Evolution API] Erro ao enviar texto (' + response.status + '):', err);
            return { success: false, error: err };
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error('[Evolution API] Erro de rede:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Envia um arquivo de mídia (PDF de treino, imagem de dieta, etc.) pelo WhatsApp
 */
async function sendWhatsAppMedia(number, mediaUrl, caption = '', fileName = 'documento.pdf') {
    const apiUrl = getCleanBaseUrl();
    const apiKey = (process.env.EVOLUTION_API_KEY || '').trim();
    const instance = (process.env.EVOLUTION_INSTANCE || 'Professor').trim();

    if (!apiUrl || !apiKey) return { success: false, message: 'Evolution API não configurada' };

    let cleanNumber = number.replace(/\D/g, '');
    if (!cleanNumber.startsWith('55')) {
        cleanNumber = '55' + cleanNumber;
    }

    const endpoint = `${apiUrl}/message/sendMedia/${instance}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                number: cleanNumber,
                media: mediaUrl,
                mediatype: 'document',
                fileName: fileName,
                caption: caption
            })
        });

        if (!response.ok) {
            const err = await response.text();
            return { success: false, error: err };
        }

        return { success: true, data: await response.json() };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Extrai texto, áudio ou imagem do payload recebido pelo webhook da Evolution API
 */
function parseEvolutionWebhook(body) {
    try {
        const event = body.event;
        const data = body.data;

        // Ignorar mensagens enviadas por nós mesmos
        if (!data || data.key?.fromMe) {
            return null;
        }

        const remoteJid = data.key?.remoteJid || '';
        const pushName = data.pushName || 'Aluno';
        const senderNumber = remoteJid.replace('@s.whatsapp.net', '');

        // Identificar texto
        let messageText = data.message?.conversation || 
                          data.message?.extendedTextMessage?.text || 
                          data.message?.imageMessage?.caption || 
                          '';

        // Identificar se tem áudio
        const isAudio = !!data.message?.audioMessage;
        const audioBase64 = data.message?.base64 || null;

        // Identificar se tem imagem
        const isImage = !!data.message?.imageMessage;
        const imageBase64 = data.message?.imageMessage?.jpegThumbnail || null;

        return {
            event,
            remoteJid,
            senderNumber,
            pushName,
            text: messageText,
            isAudio,
            audioBase64,
            isImage,
            imageBase64
        };
    } catch (err) {
        console.error('[Evolution API] Falha ao interpretar webhook:', err.message);
        return null;
    }
}

module.exports = {
    sendWhatsAppText,
    sendWhatsAppMedia,
    parseEvolutionWebhook
};
