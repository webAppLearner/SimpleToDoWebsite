require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT, msg TEXT)");
});

const activeTokens = new Set();


app.post('/api/input', async (req, res) => {
    const { input } = req.body;
    const isPassword = await bcrypt.compare(input, process.env.SECRET_HASH);

    if (isPassword) {
        const token = require('crypto').randomBytes(32).toString('hex');
        activeTokens.add(token);
        setTimeout(() => activeTokens.delete(token), 3600000); 
        return res.json({ action: 'CHAT_ACCESS', token });
    } else {
        const stmt = db.prepare("INSERT INTO tasks (task) VALUES (?)");
        stmt.run(input, function(err) {
            res.json({ action: 'TASK_ADDED', id: this.lastID, task: input });
        });
        stmt.finalize();
    }
});

app.get('/api/tasks', (req, res) => {
    db.all("SELECT * FROM tasks", [], (err, rows) => {
        res.json(rows);
    });
});

app.delete('/api/tasks/:id', (req, res) => {
    db.run("DELETE FROM tasks WHERE id = ?", req.params.id, function(err) {
        res.json({ success: true });
    });
});


io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (activeTokens.has(token)) {
        socket.userToken = token; // حفظ التوكن لمعرفة مرسل الرسالة
        next();
    } else {
        next(new Error("Unauthorized access"));
    }
});

io.on('connection', (socket) => {
    const query = "SELECT * FROM (SELECT * FROM messages ORDER BY id DESC LIMIT 10) ORDER BY id ASC";
    db.all(query, [], (err, rows) => {
        if (rows && rows.length > 0) {
            const history = rows.map(r => ({
                msg: r.msg,
                type: r.token === socket.userToken ? 'sent' : 'received'
            }));
            socket.emit('chatHistory', history);
        }
    });

    socket.on('sendMessage', (msg) => {
        db.run("INSERT INTO messages (token, msg) VALUES (?, ?)", [socket.userToken, msg]);
        
        socket.broadcast.emit('receiveMessage', msg);
    });

    socket.on('typing', () => {
        socket.broadcast.emit('typing');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`App running on port ${PORT}`));