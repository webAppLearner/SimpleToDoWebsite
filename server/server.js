const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');


const MONGO_URI = "mongodb+srv://jumkhlil_db_user:jumaahklx758274@cluster0.yzk2tsj.mongodb.net/secureChat?appName=Cluster0";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 52428800 // 50 MB
});

// الاتصال بقاعدة البيانات
mongoose.connect(MONGO_URI).then(() => {
    console.log("تم الاتصال بقاعدة البيانات بنجاح!");
}).catch(err => console.log("خطأ في الاتصال بقاعدة البيانات:", err));

// تصميم جدول الرسائل مع خاصية الحذف التلقائي بعد 48 ساعة
const messageSchema = new mongoose.Schema({
    roomCode: String,
    senderDeviceId: String,
    messageData: mongoose.Schema.Types.Mixed,
    createdAt: { 
        type: Date, 
        default: Date.now, 
        expires: 172800 // 172800 ثانية = 48 ساعة بالضبط
    }
});
const Message = mongoose.model('Message', messageSchema);

const rooms = new Map();

io.on('connection', async (socket) => {
    const { roomCode, deviceId } = socket.handshake.query;

    if (!roomCode || !deviceId) {
        socket.disconnect();
        return;
    }

    if (!rooms.has(roomCode)) {
        rooms.set(roomCode, new Set());
    }

    const roomDevices = rooms.get(roomCode);

    if (roomDevices.has(deviceId) || roomDevices.size < 2) {
        roomDevices.add(deviceId);
        socket.join(roomCode);
        console.log(`اتصال جديد: الغرفة ${roomCode} | الأجهزة: ${roomDevices.size}/2`);

        try {
            // جلب تاريخ الرسائل القديمة (لآخر 48 ساعة) عند دخول الغرفة
            const history = await Message.find({ roomCode }).sort({ createdAt: 1 });
            // إرسال السجل لهذا المستخدم فقط حتى لو كان عائداً بعد انقطاع
            socket.emit('chatHistory', history.map(h => ({
                msg: h.messageData,
                // نحدد نوع الرسالة (مرسلة أم مستلمة) بناءً على معرف الجهاز
                type: h.senderDeviceId === deviceId ? 'sent' : 'received'
            })));
        } catch (e) {
            console.log("خطأ في جلب السجل");
        }

        socket.on('sendMessage', async (messageData) => {
            // حفظ الرسالة في قاعدة البيانات
            const newMsg = new Message({ roomCode, senderDeviceId: deviceId, messageData });
            await newMsg.save();

            // بث الرسالة للطرف الآخر في الغرفة
            socket.to(roomCode).emit('receiveMessage', messageData);
        });

        socket.on('typing', () => {
            socket.to(roomCode).emit('typing');
        });

        socket.on('disconnect', () => {
            console.log(`انقطاع اتصال في الغرفة: ${roomCode}`);
        });

    } else {
        socket.emit('error', 'الغرفة ممتلئة.');
        socket.disconnect();
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل على بورت ${PORT}`);
});

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 52428800 // 50 MB
});

// الاتصال بقاعدة البيانات
mongoose.connect(MONGO_URI).then(() => {
    console.log("تم الاتصال بقاعدة البيانات بنجاح!");
}).catch(err => console.log("خطأ في الاتصال بقاعدة البيانات:", err));

// تصميم جدول الرسائل مع خاصية الحذف التلقائي بعد 48 ساعة
const messageSchema = new mongoose.Schema({
    roomCode: String,
    senderDeviceId: String,
    messageData: mongoose.Schema.Types.Mixed,
    createdAt: { 
        type: Date, 
        default: Date.now, 
        expires: 172800 // 172800 ثانية = 48 ساعة بالضبط
    }
});
const Message = mongoose.model('Message', messageSchema);

const rooms = new Map();

io.on('connection', async (socket) => {
    const { roomCode, deviceId } = socket.handshake.query;

    if (!roomCode || !deviceId) {
        socket.disconnect();
        return;
    }

    if (!rooms.has(roomCode)) {
        rooms.set(roomCode, new Set());
    }

    const roomDevices = rooms.get(roomCode);

    if (roomDevices.has(deviceId) || roomDevices.size < 2) {
        roomDevices.add(deviceId);
        socket.join(roomCode);
        console.log(`اتصال جديد: الغرفة ${roomCode} | الأجهزة: ${roomDevices.size}/2`);

        try {
            // جلب تاريخ الرسائل القديمة (لآخر 48 ساعة) عند دخول الغرفة
            const history = await Message.find({ roomCode }).sort({ createdAt: 1 });
            // إرسال السجل لهذا المستخدم فقط حتى لو كان عائداً بعد انقطاع
            socket.emit('chatHistory', history.map(h => ({
                msg: h.messageData,
                // نحدد نوع الرسالة (مرسلة أم مستلمة) بناءً على معرف الجهاز
                type: h.senderDeviceId === deviceId ? 'sent' : 'received'
            })));
        } catch (e) {
            console.log("خطأ في جلب السجل");
        }

        socket.on('sendMessage', async (messageData) => {
            const newMsg = new Message({ roomCode, senderDeviceId: deviceId, messageData });
            await newMsg.save();

            socket.to(roomCode).emit('receiveMessage', messageData);
        });

        socket.on('typing', () => {
            socket.to(roomCode).emit('typing');
        });

        socket.on('disconnect', () => {
            console.log(`انقطاع اتصال في الغرفة: ${roomCode}`);
        });

    } else {
        socket.emit('error', 'الغرفة ممتلئة.');
        socket.disconnect();
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل على بورت ${PORT}`);
});
