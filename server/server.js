const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// ربط مجلد الواجهة (HTML, CSS, JS)
app.use(express.static('public'));

const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 52428800 // 50 MB لدعم الصور
});

// ⚠️ ضع الباسورد الخاص بك هنا
const MONGO_URI = "mongodb+srv://jumkhlil_db_user:jumaahklx758274@cluster0.yzk2tsj.mongodb.net/secureChat?appName=Cluster0";

// الاتصال بقاعدة البيانات
mongoose.connect(MONGO_URI).then(() => {
    console.log("تم الاتصال بقاعدة البيانات بنجاح!");
}).catch(err => console.log("خطأ في الاتصال بقاعدة البيانات:", err));

// تصميم جدول الرسائل للحفظ (وتنحذف تلقائياً بعد 48 ساعة)
const messageSchema = new mongoose.Schema({
    messageData: mongoose.Schema.Types.Mixed,
    createdAt: { 
        type: Date, 
        default: Date.now, 
        expires: 172800 
    }
});
const Message = mongoose.model('Message', messageSchema);

io.on('connection', async (socket) => {
    console.log('مستخدم جديد اتصل بالمحادثة');

    // 1. جلب الرسائل القديمة فور دخول المستخدم وإرسالها له
    try {
        const history = await Message.find().sort({ createdAt: 1 });
        // نرسل السجل كـ مصفوفة
        socket.emit('chatHistory', history.map(h => h.messageData));
    } catch (e) {
        console.log("خطأ في جلب السجل");
    }

    // 2. استلام رسالة جديدة
    socket.on('sendMessage', async (messageData) => {
        // حفظ الرسالة في السحابة
        try {
            const newMsg = new Message({ messageData });
            await newMsg.save();
        } catch (err) {
            console.log("خطأ في حفظ الرسالة:", err);
        }

        // إرسالها للطرف الآخر
        socket.broadcast.emit('receiveMessage', messageData);
    });

    socket.on('typing', () => {
        socket.broadcast.emit('typing');
    });

    socket.on('disconnect', () => {
        console.log('المستخدم غادر المحادثة');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل على بورت ${PORT}`);
});
