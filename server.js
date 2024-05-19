
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        allowedHeaders: ["Authorization"],
        credentials: true
    }
});

app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/chatapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const User = require('./models/User');
const Message = require('./models/Message');

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('join', async (userId) => {
        socket.join(userId);
        try {
            const user = await User.findByIdAndUpdate(userId, { online: true }, { new: true });
            if (user) {
                io.emit('user-online', user);
            }
        } catch (err) {
            console.error('Error updating user status:', err);
        }
    });

    
    socket.on('message', async ({ sender, receiver, content }) => {
        console.log('Sender:', sender);
        console.log('Receiver:', receiver);
        try {
            const senderId = new mongoose.Types.ObjectId(sender);
            const receiverId = new mongoose.Types.ObjectId(receiver);
    
            const message = new Message({ sender: senderId, receiver: receiverId, content });
            await message.save();
    
            const senderUser = await User.findById(senderId);
            const receiverUser = await User.findById(receiverId);
    
            io.to(receiver).emit('message', {
                sender: { _id: senderUser._id, username: senderUser.username },
                receiver: { _id: receiverUser._id, username: receiverUser.username },
                content: message.content
            });
            io.to(sender).emit('message', {
                sender: { _id: senderUser._id, username: senderUser.username },
                receiver: { _id: receiverUser._id, username: receiverUser.username },
                content: message.content
            });
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });
    


    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

app.get('/api/messages/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const messages = await Message.find({ $or: [{ sender: userId }, { receiver: userId }] }).populate('sender receiver', 'username');
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve messages' });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
