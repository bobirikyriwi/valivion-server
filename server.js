const express = require('express');
const app = express();

// Позволяет серверу читать JSON из запросов чита
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Хранилища данных в памяти сервера
let usersOnline = new Map(); // username -> { lastSeen: timestamp, jobId: string }
let lobbyMusic = new Map();  // jobId -> { trackId, songTitle, sender, timestamp }

// 1. Проверка работоспособности (чтобы сервер не спал)
app.get('/', (req, res) => {
    res.send("Valivion Hub Server is Running!");
});

// 2. Пинг от чита (обновляет онлайн и отдаёт статус музыки в каcompanionтке)
app.post('/api/ping', (req, res) => {
    const { username, jobId } = req.body;
    const now = Date.now();

    if (username) {
        usersOnline.set(username, { lastSeen: now, jobId: jobId || "" });
    }

    // Удаляем из онлайна тех, от кого не было запросов больше 20 секунд
    for (let [user, data] of usersOnline.entries()) {
        if (now - data.lastSeen > 20000) {
            usersOnline.delete(user);
        }
    }

    // Смотрим, не играет ли кто-то музыку в каcompanionтке с таким же jobId
    const currentMusic = lobbyMusic.get(jobId) || null;

    res.json({
        onlineCount: usersOnline.size,
        currentMusic: currentMusic
    });
});

// 3. Событие: кто-то включил трек в своём радио
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

app.listen(PORT, () => {
    console.log(`[VALIVION] Сервер успешно запущен на порту ${PORT}`);
});