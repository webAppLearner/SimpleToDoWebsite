require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose'); // استبدال مكتبة sqlite3
const path = require('path');
const crypto = require('crypto'); // ضروري لتوليد التوكن

const app = express();
const server = http.createServer(app);

// رفع حد البفر لدعم الصور والمقاطع
const io = new Server(server, { 
    cors: { origin: "*" }, 
    maxHttpBufferSize: 52428800 
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '/public')));

// ⚠️ رابط قاعدة البيانات السحابية (يفضل وضعه في ملف .env مستقبلاً)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://jumkhlil_db_user:<jumaahklx758274>@cluster0.yzk2tsj.mongodb.net/?appName=Cluster0";

// الاتصال بقاعدة بيانات MongoDB السحابية
mongoose.connect(MONGO_URI).then(() => {
    console.log("تم الاتصال بقاعدة بيانات MongoDB بنجاح!");
}).catch(err => console.log("خطأ في الاتصال بقاعدة البيانات:", err));

// --- بناء الجداول (Schemas) ---

// 1. جدول المهام (للتمويه)
const taskSchema = new mongoose.Schema({
    task: String
});
const Task = mongoose.model('Task', taskSchema);

// 2. جدول الرسائل (مع خاصية الحذف التلقائي بعد 48 ساعة)
const messageSchema = new mongoose.Schema({
    token: String,
    msg: String,
    createdAt: { type: Date, default: Date.now, expires: 172800 }
});
const Message = mongoose.model('Message', messageSchema);

const activeTokens = new Set();

// --- مسارات HTTP للمهام (To-Do List) ---

app.post('/api/input', async (req, res) => {
    try {
        const { input } = req.body;
        const isPassword = await bcrypt.compare(input, process.env.SECRET_HASH);

        if (isPassword) {
            // توليد توكن سري وإعطاء صلاحية للدردشة
            const token = crypto.randomBytes(32).toString('hex');
            activeTokens.add(token);
            setTimeout(() => activeTokens.delete(token), 3600000); // يحذف بعد ساعة
            return res.json({ action: 'CHAT_ACCESS', token });
        } else {
            // حفظ كمهمة عادية في قاعدة البيانات
            const newTask = await Task.create({ task: input });
            // إرجاع id بدلاً من _id ليتوافق مع واجهتك القديمة
            res.json({ action: 'TASK_ADDED', id: newTask._id, task: input });
        }
    } catch (error) {
        console.error("Error in /api/input:", error);
        res.status(500).json({ error: "Server Error" });
    }
});

app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.find();
        // إعادة صياغة الـ id ليتوافق مع الفرونت إند
        const formattedTasks = tasks.map(t => ({ id: t._id, task: t.task }));
        res.json(formattedTasks);
    } catch (error) {
        res.status(500).json({ error: "Error fetching tasks" });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        await Task.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error deleting task" });
    }
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

io.on('connection', async (socket) => {
    // جلب آخر 10 رسائل من قاعدة البيانات السحابية وإرسالها للمستخدم عند الدخول
    try {
        // فرز تنازلي لجلب أحدث 10، ثم عكسها لتعرض بالترتيب الصحيح (من الأقدم للأحدث)
        const rows = await Message.find().sort({ createdAt: -1 }).limit(10);
        const sortedRows = rows.reverse();

        if (sortedRows.length > 0) {
            const history = sortedRows.map(r => ({
                msg: r.msg,
                type: r.token === socket.userToken ? 'sent' : 'received'
            }));
            socket.emit('chatHistory', history);
        }
    } catch (error) {
        console.error("خطأ في جلب السجل:", error);
    }

    socket.on('sendMessage', async (msg) => {
        try {
            // حفظ الرسالة في السحابة
            await Message.create({ token: socket.userToken, msg });
            // إرسالها للطرف الآخر
            socket.broadcast.emit('receiveMessage', msg);
        } catch (error) {
            console.error("خطأ في حفظ الرسالة:", error);
        }
    });

    socket.on('typing', () => {
        socket.broadcast.emit('typing');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`App running on port ${PORT}`));
