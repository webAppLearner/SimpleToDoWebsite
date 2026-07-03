require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors'); // مضافة لضمان قبول اتصالات فلاتر بدون حظر

const app = express();
const server = http.createServer(app);

// إعداد الـ Socket.io مع السماح لجميع الاتصالات الخارجية (CORS)
const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 52428800 // 50 MB لدعم الصور والمستندات
});

app.use(cors());
app.use(express.json());

// ربط مجلد الملفات العامة (تأكد من تعديل المسار حسب هيكلة مجلداتك)
app.use(express.static(path.join(__dirname, 'public')));

// --- الذاكرة المؤقتة البديلة لقواعد البيانات ---
let tasks = [];       // مصفوفة لحفظ المهام الوهمية
let messages = [];    // مصفوفة لحفظ الرسائل (آخر 10 رسائل)
const activeTokens = new Set();

// --- مسارات HTTP للمهام الوهمية (To-Do) ---

app.post('/api/input', async (req, res) => {
    try {
        const { input } = req.body;
        
        // التحقق من كلمة السر المشفرة في ملف .env
        // إذا لم يكن الملف موجوداً، سيتم مقارنتها بكلمة سر افتراضية هي "12345" لضمان عدم انهيار السيرفر
        const secretHash = process.env.SECRET_HASH || await bcrypt.hash("12345", 10);
        const isPassword = await bcrypt.compare(input, secretHash);

        if (isPassword) {
            const token = crypto.randomBytes(32).toString('hex');
            activeTokens.add(token);
            setTimeout(() => activeTokens.delete(token), 3600000); // صلاحية التوكن ساعة واحدة
            return res.json({ action: 'CHAT_ACCESS', token });
        } else {
            // حفظ المهمة في ذاكرة السيرفر المؤقتة بدلاً من SQLite
            const taskId = Date.now(); // توليد معرف فريد مؤقت بناءً على الوقت
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
    // جلب المهام من الذاكرة مباشرة
    res.json(tasks);
});

app.delete('/api/tasks/:id', (req, res) => {
    const taskId = req.params.id;
    // حذف المهمة من المصفوفة
    tasks = tasks.filter(t => t.id.toString() !== taskId.toString());
    res.json({ success: true });
});

// --- مسارات Socket.io للدردشة السرية ---

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
    console.log('مستخدم متصل بالدردشة السرية');

    // جلب آخر 10 رسائل من الذاكرة وإرسالها للمستخدم فور دخوله
    const history = messages.slice(-10).map(m => ({
        msg: m.msg,
        type: m.token === socket.userToken ? 'sent' : 'received'
    }));
    socket.emit('chatHistory', history);

    socket.on('sendMessage', (msg) => {
        // حفظ الرسالة في ذاكرة السيرفر
        messages.push({ token: socket.userToken, msg: msg });
        
        // بث الرسالة للطرف الآخر
        socket.broadcast.emit('receiveMessage', msg);
    });

    socket.on('typing', () => {
        socket.broadcast.emit('typing');
    });

    socket.on('disconnect', () => {
        console.log('مستخدم غادر الدردشة');
    });
});

// إضافة مسار رئيسي للتأكد من عمل السيرفر عند فتحه من المتصفح
app.get('/', (req, res) => {
    res.send('<h1>سيرفر المحادثة والمهام يعمل بنجاح وبدون قواعد بيانات 🚀</h1>');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`App running on port ${PORT}`));
