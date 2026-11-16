/**
 * Database & Cache Service - Shape Mestre
 * Suporta PostgreSQL e Redis com fallback em memória
 */

let memoryStore = {
    users: {},
    diaries: {},
    chats: {}
};

/**
 * Salva histórico de chat para um usuário (por telefone ou sessão)
 */
async function saveChatMessage(sessionKey, role, content, agent = 'personal') {
    if (!memoryStore.chats[sessionKey]) {
        memoryStore.chats[sessionKey] = [];
    }
    const msg = { role, content, agent, timestamp: new Date().toISOString() };
    memoryStore.chats[sessionKey].push(msg);

    // Manter no máximo 30 mensagens por sessão em memória
    if (memoryStore.chats[sessionKey].length > 30) {
        memoryStore.chats[sessionKey].shift();
    }
    return msg;
}

/**
 * Obtém o histórico de mensagens de uma sessão
 */
async function getChatHistory(sessionKey, limit = 10) {
    const list = memoryStore.chats[sessionKey] || [];
    return list.slice(-limit);
}

/**
 * Salva item no diário alimentar
 */
async function saveFoodItem(userId, item) {
    if (!memoryStore.diaries[userId]) {
        memoryStore.diaries[userId] = [];
    }
    const record = { id: Date.now(), ...item, date: new Date().toISOString() };
    memoryStore.diaries[userId].push(record);
    return record;
}

/**
 * Lista itens do diário alimentar do dia
 */
async function getTodayFoodItems(userId) {
    const list = memoryStore.diaries[userId] || [];
    const today = new Date().toISOString().slice(0, 10);
    return list.filter(it => it.date.startsWith(today));
}

module.exports = {
    saveChatMessage,
    getChatHistory,
    saveFoodItem,
    getTodayFoodItems
};
