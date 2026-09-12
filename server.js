const express = require('express');
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 8080;

let usersOnline = new Map();  // username -> { lastSeen, jobId, squadId }
let lobbyMusic = new Map();   // jobId -> { trackId, songTitle, sender, timestamp }
let chatMessages = [];        // [ { id, username, text, channel, squadId, timestamp } ]
let lobbyClones = new Map();  // jobId -> Map(username -> [ { id, cframe } ])

const MAX_CHAT_HISTORY = 60;

app.get('/', (req, res) => res.send("Valivion Glassmorphism Backend v3.0"));

// Пинг чита
app.post('/api/ping', (req, res) => {
    const { username, jobId, squadId } = req.body;
    const now = Date.now();

    if (username) {
        usersOnline.set(username, { lastSeen: now, jobId: jobId || "", squadId: squadId || "Global" });
    }

    for (let [user, data] of usersOnline.entries()) {
        if (now - data.lastSeen > 20000) {
            usersOnline.delete(user);
            if (data.jobId && lobbyClones.has(data.jobId)) lobbyClones.get(data.jobId).delete(user);
        }
    }

    const currentMusic = lobbyMusic.get(jobId) || null;

    let clonesInLobby = [];
    if (jobId && lobbyClones.has(jobId)) {
        for (let [user, userClones] of lobbyClones.get(jobId).entries()) {
            for (let cl of userClones) clonesInLobby.push({ owner: user, ...cl });
        }
    }

    const filteredChat = chatMessages.filter(msg => {
        if (msg.channel === "global") return true;
        if (msg.channel === "squad" && squadId && msg.squadId === squadId) return true;
        return false;
    }).slice(-30);

    res.json({
        onlineCount: usersOnline.size,
        currentMusic: currentMusic,
        chat: filteredChat,
        clones: clonesInLobby
    });
});

// Общее 3D радио
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

// Чат
app.post('/api/chat', (req, res) => {
    const { username, message, channel, squadId } = req.body;
    if (!username || !message || typeof message !== 'string') return res.status(400).json({ error: "Invalid payload" });
    const cleanText = message.trim().slice(0, 200);
    if (cleanText.length === 0) return res.status(400).json({ error: "Empty message" });

    const msgObj = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        username: username,
        text: cleanText,
        channel: channel || "global",
        squadId: squadId || "Global",
        timestamp: Date.now()
    };
    chatMessages.push(msgObj);
    if (chatMessages.length > MAX_CHAT_HISTORY) chatMessages.shift();
    res.json({ success: true, message: msgObj });
});

// Спавн клона (с кастомным лимитом от клиента)
app.post('/api/clone/spawn', (req, res) => {
    const { username, jobId, cframe, maxLimit } = req.body;
    if (!username || !jobId || !cframe) return res.status(400).json({ error: "Missing data" });

    const limit = typeof maxLimit === "number" ? Math.clamp(maxLimit, 1, 50) : 10;
    if (!lobbyClones.has(jobId)) lobbyClones.set(jobId, new Map());
    const userMap = lobbyClones.get(jobId);
    let userClones = userMap.get(username) || [];

    if (userClones.length >= limit) return res.status(400).json({ error: "Limit reached" });

    const newClone = { id: "cl_" + Date.now() + "_" + Math.floor(Math.random() * 1000), cframe };
    userClones.push(newClone);
    userMap.set(username, userClones);
    res.json({ success: true, clone: newClone, count: userClones.length });
});

app.post('/api/clone/clear', (req, res) => {
    const { username, jobId } = req.body;
    if (jobId && lobbyClones.has(jobId)) lobbyClones.get(jobId).delete(username);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`[VALIVION] Сервер запущен на порту ${PORT}`));