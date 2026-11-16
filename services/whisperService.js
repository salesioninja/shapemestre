/**
 * Whisper Service - Transcrição de Áudio via OpenAI Whisper
 */

const fs = require('fs');

/**
 * Transcreve um arquivo de áudio (Buffer ou caminho) para texto em Português
 */
async function transcribeAudio(audioBuffer, filename = 'audio.webm') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY não configurada para transcrição Whisper.');
    }

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('file', blob, filename);
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`
        },
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro no Whisper (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.text || '';
}

module.exports = {
    transcribeAudio
};
