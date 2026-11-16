/**
 * Chat.js - Módulo de Inteligência Artificial do Shape Mestre
 * Comunicação direta com OpenAI (GPT/Whisper) e Google Gemini 2.5 Flash
 */

let activeAgent = 'personal'; // 'personal' ou 'mia'
let chatSessionKey = 'shape-user-' + (localStorage.getItem('shape_user_id') || Math.random().toString(36).substring(7));
localStorage.setItem('shape_user_id', chatSessionKey);

let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let selectedImageFile = null;

// Alternar entre Personal e Nutricionista
function setChatAgent(agent) {
    activeAgent = agent;
    const btnPersonal = document.getElementById('btn-agent-personal');
    const btnMia = document.getElementById('btn-agent-mia');
    const welcomeAgent = document.getElementById('chat-welcome-agent');
    const welcomeText = document.getElementById('chat-welcome-text');
    const welcomeIcon = document.getElementById('chat-welcome-icon');

    if (agent === 'personal') {
        if (btnPersonal) btnPersonal.className = 'flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 bg-neoncyan text-black shadow';
        if (btnMia) btnMia.className = 'flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 text-gray-400 hover:text-white';
        if (welcomeAgent) {
            welcomeAgent.textContent = 'Personal Trainer IA';
            welcomeAgent.className = 'font-bold text-xs uppercase tracking-wider text-neoncyan';
        }
        if (welcomeIcon) welcomeIcon.className = 'w-3.5 h-3.5 text-neoncyan';
        if (welcomeText) welcomeText.textContent = 'Olá! Eu sou o seu Personal Trainer IA do Shape Mestre. Como posso turbinar seu treino hoje? Você pode digitar, mandar áudio pelo microfone ou tirar foto de um exercício!';
    } else {
        if (btnMia) btnMia.className = 'flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 bg-neonpink text-black shadow';
        if (btnPersonal) btnPersonal.className = 'flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 text-gray-400 hover:text-white';
        if (welcomeAgent) {
            welcomeAgent.textContent = 'MIA Nutricionista IA';
            welcomeAgent.className = 'font-bold text-xs uppercase tracking-wider text-neonpink';
        }
        if (welcomeIcon) welcomeIcon.className = 'w-3.5 h-3.5 text-neonpink';
        if (welcomeText) welcomeText.textContent = 'Olá! Eu sou a MIA, sua mentora nutricional. Me conte o que você comeu hoje ou mande uma foto do seu prato para calcularmos os macros!';
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

// Submissão do Chat
async function handleChatSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();

    if (!text && !selectedImageFile) return;

    // Se houver imagem selecionada, enviar via rota de imagem
    if (selectedImageFile) {
        const file = selectedImageFile;
        clearImagePreview();
        input.value = '';

        appendMessage('user', text ? `${text} (com foto)` : '📷 Foto enviada para análise');
        const loadingId = appendLoadingIndicator();

        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('prompt', text || '');
            formData.append('agent', activeAgent);
            formData.append('sessionKey', chatSessionKey);

            const res = await fetch('/api/chat/image', {
                method: 'POST',
                body: formData
            });

            removeLoadingIndicator(loadingId);
            const data = await res.json();
            if (data.response) {
                appendMessage('ai', data.response);
            } else {
                appendMessage('ai', 'Não foi possível analisar a imagem no momento.');
            }
        } catch (err) {
            removeLoadingIndicator(loadingId);
            appendMessage('ai', 'Erro ao conectar ao servidor de IA.');
        }
        return;
    }

    // Envio de texto normal
    input.value = '';
    appendMessage('user', text);
    const loadingId = appendLoadingIndicator();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: text,
                agent: activeAgent,
                sessionKey: chatSessionKey
            })
        });

        removeLoadingIndicator(loadingId);
        const data = await res.json();

        if (data.response) {
            appendMessage('ai', data.response);
        } else {
            appendMessage('ai', 'Desculpe, ocorreu uma instabilidade na resposta da IA.');
        }
    } catch (err) {
        removeLoadingIndicator(loadingId);
        appendMessage('ai', 'Erro de conexão com o servidor de IA.');
    }
}

// Gravação de Áudio via Microfone
async function toggleAudioRecording() {
    const micBtn = document.getElementById('chat-mic-btn');
    const micIcon = document.getElementById('mic-icon');

    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await sendAudioMessage(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isRecording = true;
            micBtn.classList.add('bg-red-600', 'text-white', 'animate-pulse');
            showToast('Gravando áudio... Clique novamente para enviar.', 'success');
        } catch (err) {
            alert('Não foi possível acessar seu microfone. Verifique as permissões do navegador.');
        }
    } else {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        isRecording = false;
        micBtn.classList.remove('bg-red-600', 'text-white', 'animate-pulse');
    }
}

// Envio de Áudio para o Backend (Whisper -> IA)
async function sendAudioMessage(audioBlob) {
    appendMessage('user', '🎙️ Mensagem de áudio enviada...');
    const loadingId = appendLoadingIndicator();

    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'gravacao.webm');
        formData.append('agent', activeAgent);
        formData.append('sessionKey', chatSessionKey);

        const res = await fetch('/api/chat/audio', {
            method: 'POST',
            body: formData
        });

        removeLoadingIndicator(loadingId);
        const data = await res.json();

        if (data.transcript) {
            appendMessage('user', `🎙️ "${data.transcript}"`);
        }
        if (data.response) {
            appendMessage('ai', data.response);
        }
    } catch (err) {
        removeLoadingIndicator(loadingId);
        appendMessage('ai', 'Erro ao processar áudio.');
    }
}

// Tratamento de Imagem Selecionada
function handleImageSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    selectedImageFile = file;
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview');
    const previewName = document.getElementById('image-preview-name');

    previewImg.src = URL.createObjectURL(file);
    previewName.textContent = file.name;
    previewContainer.classList.remove('hidden');
}

function clearImagePreview() {
    selectedImageFile = null;
    const previewContainer = document.getElementById('image-preview-container');
    previewContainer.classList.add('hidden');
    document.getElementById('chat-file-input').value = '';
}

// Adicionar Balão de Mensagem
function appendMessage(sender, text) {
    const chatContainer = document.getElementById('chat-messages');
    const isUser = sender === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = `flex ${isUser ? 'justify-end' : 'justify-start'}`;

    const formattedText = text.replace(/\n/g, '<br/>').replace(/\*(.*?)\*/g, '<b>$1</b>');

    const bubble = document.createElement('div');
    bubble.className = `${isUser ? 'chat-bubble-user text-white' : 'chat-bubble-ai text-gray-200'} max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-lg`;
    bubble.innerHTML = formattedText;

    wrapper.appendChild(bubble);
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendLoadingIndicator() {
    const id = 'loading-' + Date.now();
    const chatContainer = document.getElementById('chat-messages');
    const wrapper = document.createElement('div');
    wrapper.id = id;
    wrapper.className = 'flex justify-start';
    wrapper.innerHTML = `
        <div class="chat-bubble-ai p-3 rounded-2xl text-xs text-neoncyan flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-neoncyan animate-ping"></span>
            <span>Digitando...</span>
        </div>
    `;
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return id;
}

function removeLoadingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// Modal WhatsApp
function openWhatsAppShareModal() {
    const modal = document.getElementById('whatsapp-modal');
    const savedPhone = localStorage.getItem('shape_user_phone') || '';
    document.getElementById('whatsapp-phone-input').value = savedPhone;
    modal.classList.remove('hidden');
}

function closeWhatsAppModal() {
    document.getElementById('whatsapp-modal').classList.add('hidden');
}

async function confirmSendWhatsApp() {
    const phoneInput = document.getElementById('whatsapp-phone-input');
    const phone = phoneInput.value.trim();
    if (!phone) {
        alert('Por favor, informe seu número de WhatsApp com DDD.');
        return;
    }

    localStorage.setItem('shape_user_phone', phone);
    const planText = window.currentWhatsAppShareText || 'Olá! Gostaria de receber meus dados e treinos do Shape Mestre.';
    const title = window.currentWhatsAppShareTitle || 'Treino Shape Mestre';

    const btn = document.getElementById('btn-confirm-whatsapp');
    btn.textContent = 'Enviando...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/whatsapp/send-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone,
                planText,
                title
            })
        });

        const data = await res.json();
        closeWhatsAppModal();

        if (data.success) {
            showToast('✅ Enviado para seu WhatsApp com sucesso!', 'success');
        } else {
            showToast('⚠️ Solicitação registrada! Conecte a Evolution API para entrega instantânea.', 'error');
        }
    } catch (err) {
        closeWhatsAppModal();
        showToast('Erro ao conectar com o serviço de WhatsApp.', 'error');
    } finally {
        btn.textContent = 'Enviar Agora';
        btn.disabled = false;
    }
}
