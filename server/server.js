require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 52428800 // لدعم الصور والمقاطع
});

app.use(cors());
app.use(express.json());

// ربط مجلد الواجهة
app.use(express.static(path.join(__dirname, 'public')));

// الذاكرة المؤقتة البديلة لقاعدة البيانات
let tasks = [];
let messages = [];
const activeTokens = new Set();

app.post('/api/input', async (req, res) => {
    try {
        const { input } = req.body;
        
        // التحقق من كلمة السر (12345)
        const secretHash = process.env.SECRET_HASH || await bcrypt.hash("12345", 10);
        const isPassword = await bcrypt.compare(input, secretHash);

        if (isPassword) {
            const token = crypto.randomBytes(32).toString('hex');
            activeTokens.add(token);
            setTimeout(() => activeTokens.delete(token), 3600000);
            return res.json({ action: 'CHAT_ACCESS', token });
        } else {
            const taskId = Date.now();
            const newTask = { id: taskId, task: input };
            tasks.push(newTask);
            return res.json({ action: 'TASK_ADDED', id: taskId, task: input });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server Error" });
    }
});

app.get('/api/tasks', (req, res) => {
    res.json(tasks);
});

app.delete('/api/tasks/:id', (req, res) => {
    const taskId = req.params.id;
    tasks = tasks.filter(t => t.id.toString() !== taskId.toString());
    res.json({ success: true });
});

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (activeTokens.has(token)) {
        socket.userToken = token;
        next();
    } else {
        next(new Error("Unauthorized access"));
    }
});

io.on('connection', (socket) => {
    const history = messages.slice(-10).map(m => ({
        msg: m.msg,
        type: m.token === socket.userToken ? 'sent' : 'received'
    }));
    socket.emit('chatHistory', history);

    socket.on('sendMessage', (msg) => {
        messages.push({ token: socket.userToken, msg: msg });
        socket.broadcast.emit('receiveMessage', msg);
    });

    socket.on('typing', () => {
        socket.broadcast.emit('typing');
    });
});

 
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`App running on port ${PORT}`));
