const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// إعداد الـ Socket.io
const io = new Server(server, { 
    cors: { origin: "*" }, 
    maxHttpBufferSize: 52428800 
});

// ربط قاعدة البيانات
const MONGO_URI = "mongodb+srv://jumkhlil_db_user:jumaahklx758274@cluster0.yzk2tsj.mongodb.net/secureChat?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("تم الاتصال بقاعدة البيانات بنجاح!"))
    .catch(err => console.log("خطأ في الاتصال:", err));

// تصميم بسيط لجدول الرسائل
const messageSchema = new mongoose.Schema({
    messageData: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now, expires: 172800 } // حذف تلقائي بعد 48 ساعة
});
const Message = mongoose.model('Message', messageSchema);

io.on('connection', async (socket) => {
    console.log('مستخدم جديد اتصل');

    // عند الاتصال، نرسل للمستخدم آخر الرسائل المحفوظة
    try {
        const history = await Message.find().sort({ createdAt: 1 });
        socket.emit('chatHistory', history.map(h => h.messageData));
    } catch (e) {
        console.log("خطأ في جلب السجل");
    }

    // استلام الرسالة وإرسالها للجميع (Broadcast)
    socket.on('sendMessage', async (messageData) => {
        try {
            const newMsg = new Message({ messageData });
            await newMsg.save();
        } catch (err) {
            console.log("خطأ في الحفظ:", err);
        }
        
        socket.broadcast.emit('receiveMessage', messageData);
    });

    socket.on('disconnect', () => {
        console.log('مستخدم غادر');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`السيرفر يعمل على بورت ${PORT}`));
