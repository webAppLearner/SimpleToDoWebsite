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


const messageSchema = new mongoose.Schema({
    roomCode: String,
    senderDeviceId: String,
    messageData: mongoose.Schema.Types.Mixed,
    createdAt: { 
        type: Date, 
        default: Date.now, 
        expires: 172800 
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
            const history = await Message.find({ roomCode }).sort({ createdAt: 1 });
            socket.emit('chatHistory', history.map(h => ({
                msg: h.messageData,
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
