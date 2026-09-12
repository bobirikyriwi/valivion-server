const express = require('express');
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 8080;

// Хранилища данных в памяти сервера
let usersOnline = new Map();  // username -> { lastSeen: timestamp, jobId: string }
let lobbyMusic = new Map();   // jobId -> { trackId, songTitle, sender, timestamp }
let chatMessages = [];        // [ { id, username, text, timestamp } ]
let lobbyClones = new Map();  // jobId -> Map(username -> [ { id, cframe } ])

const MAX_CHAT_HISTORY = 60;
const MAX_CLONES_PER_USER = 5;

// 1. Проверка работоспособности
app.get('/', (req, res) => {
    res.send("Valivion Hub Server is Running!");
});

// 2. Пинг чита: онлайн, музыка, чат и клоны
app.post('/api/ping', (req, res) => {
    const { username, jobId } = req.body;
    const now = Date.now();

    if (username) {
        usersOnline.set(username, { lastSeen: now, jobId: jobId || "" });
    }

    // Удаляем неактивных (не было пинга > 20 сек)
    for (let [user, data] of usersOnline.entries()) {
        if (now - data.lastSeen > 20000) {
            usersOnline.delete(user);
            if (data.jobId && lobbyClones.has(data.jobId)) {
                lobbyClones.get(data.jobId).delete(user);
            }
        }
    }

    const currentMusic = lobbyMusic.get(jobId) || null;

    // Собираем всех активных клонов в этой же сессии (jobId)
    let clonesInLobby = [];
    if (jobId && lobbyClones.has(jobId)) {
        for (let [user, userClones] of lobbyClones.get(jobId).entries()) {
            for (let cl of userClones) {
                clonesInLobby.push({ owner: user, ...cl });
            }
        }
    }

    res.json({
        onlineCount: usersOnline.size,
        currentMusic: currentMusic,
        chat: chatMessages.slice(-30),
        clones: clonesInLobby
    });
});

// 3. Синхронизация общего радио
app.post('/api/music', (req, res) => {
    const { username, jobId, trackId, songTitle } = req.body;

    if (jobId && trackId) {
        lobbyMusic.set(jobId, {
            trackId: trackId,
            songTitle: songTitle || "Track " + trackId,
            sender: username || "Unknown",
            timestamp: Date.now()
        });
        return res.json({ success: true });
    }

    res.status(400).json({ error: "Missing parameters" });
});

// 4. Глобальный чат между пользователями чита
app.post('/api/chat', (req, res) => {
    const { username, message } = req.body;

    if (!username || !message || typeof message !== 'string') {
        return res.status(400).json({ error: "Invalid message data" });
    }

    const cleanText = message.trim().slice(0, 200);
    if (cleanText.length === 0) {
        return res.status(400).json({ error: "Message empty" });
    }

    const msgObj = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        username: username,
        text: cleanText,
        timestamp: Date.now()
    };

    chatMessages.push(msgObj);
    if (chatMessages.length > MAX_CHAT_HISTORY) {
        chatMessages.shift();
    }

    res.json({ success: true, message: msgObj });
});

// 5. Создание клона (лимит: 5 на игрока)
app.post('/api/clone/spawn', (req, res) => {
    const { username, jobId, cframe } = req.body;

    if (!username || !jobId || !cframe) {
        return res.status(400).json({ error: "Missing clone data" });
    }

    if (!lobbyClones.has(jobId)) {
        lobbyClones.set(jobId, new Map());
    }

    const userMap = lobbyClones.get(jobId);
    let userClones = userMap.get(username) || [];

    if (userClones.length >= MAX_CLONES_PER_USER) {
        return res.status(400).json({ error: "Лимит: максимум 5 клонов!" });
    }

    const newClone = {
        id: "cl_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        cframe: cframe
    };

    userClones.push(newClone);
    userMap.set(username, userClones);

    res.json({ success: true, clone: newClone, currentCount: userClones.length });
});

// 6. Очистка клонов игрока
app.post('/api/clone/clear', (req, res) => {
    const { username, jobId } = req.body;
    if (jobId && lobbyClones.has(jobId)) {
        lobbyClones.get(jobId).delete(username);
    }
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`[VALIVION] Сервер успешно запущен на порту ${PORT}`);
});