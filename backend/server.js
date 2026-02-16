require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('ws');
const Message = require('./models/Message');
const User = require('./models/User');
const { Expo } = require('expo-server-sdk');
const expo = new Expo();

const app = express();
const server = http.createServer(app);
const wss = new Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// MongoDB Connection Singleton
let cachedPromise = null;

const connectToDatabase = async () => {
    if (cachedPromise) {
        return cachedPromise;
    }

    console.log('Connecting to MongoDB Atlas...');
    cachedPromise = mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        bufferCommands: false, // Fail fast if not connected
    }).then(() => {
        console.log('Connected to MongoDB');
    }).catch(err => {
        cachedPromise = null;
        console.error('MongoDB connection error:', err);
        throw err;
    });

    return cachedPromise;
};

// Middleware to ensure DB is connected before processing requests
app.use(async (req, res, next) => {
    try {
        await connectToDatabase();
        next();
    } catch (err) {
        res.status(500).json({ error: 'Database connection failed', details: err.message });
    }
});

// ... (Rest of the file remains same, but we need to change how we listen)

const jwt = require('jsonwebtoken');

// Client connection mapping: userId -> Set of WebSocket connections
const clients = new Map();

// WebSocket handling
wss.on('connection', (ws) => {
    console.log('New WebSocket connection attempt');
    let currentUserId = null;

    ws.on('message', async (message) => {
        // console.log(`[WS Receive] ${message}`);
        try {
            const data = JSON.parse(message);

            // Authentication
            if (data.type === 'auth') {
                const token = data.token;
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                currentUserId = decoded.userId;

                if (!clients.has(currentUserId)) {
                    clients.set(currentUserId, new Set());
                }
                clients.get(currentUserId).add(ws);
                console.log(`User ${currentUserId} authenticated via WebSocket`);
                return;
            }

            if (!currentUserId) {
                return ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            }

            // Message Relay
            if (data.type === 'chat_message') {
                const { recipientId, content, nonce, messageId, timestamp } = data;

                if (!content || !nonce) {
                    return ws.send(JSON.stringify({ type: 'error', message: 'Missing content or nonce' }));
                }

                // PERSISTENCE: Save to MongoDB (Encrypted blob)
                const newMessage = new Message({
                    senderId: currentUserId,
                    recipientId: recipientId,
                    content: content,
                    nonce: nonce,
                    messageId: messageId,
                    timestamp: timestamp || new Date()
                });
                await newMessage.save().catch(err => console.error('Failed to save message to DB:', err));

                // Construct message to relay
                const relayData = JSON.stringify({
                    type: 'chat_message',
                    senderId: currentUserId,
                    content,
                    nonce,
                    messageId,
                    timestamp: timestamp || new Date()
                });

                // Send to all recipient's active connections
                if (clients.has(recipientId)) {
                    clients.get(recipientId).forEach(client => {
                        if (client.readyState === ws.OPEN) {
                            client.send(relayData);
                        }
                    });
                } else {
                    console.log(`Recipient ${recipientId} is offline`);
                }

                // PUSH NOTIFICATION: Send even if online (to ensure alert)
                try {
                    const recipientUser = await User.findById(recipientId);
                    if (recipientUser && recipientUser.pushToken && Expo.isExpoPushToken(recipientUser.pushToken)) {
                        const senderUser = await User.findById(currentUserId);
                        await expo.sendPushNotificationsAsync([{
                            to: recipientUser.pushToken,
                            sound: 'default',
                            title: senderUser ? senderUser.displayName : 'New Message',
                            body: 'You have a new encrypted message',
                            data: { senderId: currentUserId, type: 'chat_message' },
                        }]);
                        console.log(`Push notification sent to ${recipientId}`);
                    }
                } catch (pushErr) {
                    console.error('Push notification error:', pushErr);
                }

                return;
            }

        } catch (err) {
            console.error('WebSocket message error:', err);
        }
    });

    ws.on('close', () => {
        if (currentUserId && clients.has(currentUserId)) {
            clients.get(currentUserId).delete(ws);
            if (clients.get(currentUserId).size === 0) {
                clients.delete(currentUserId);
            }
        }
        console.log('Client disconnected');
    });
});

// Routes
app.get('/', (req, res) => {
    res.send('Messaging App Backend is running');
});

// Auth Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Contact Routes
const contactRoutes = require('./routes/contacts');
app.use('/api/contacts', contactRoutes);

// Verification Routes
const verificationRoutes = require('./routes/verification');
app.use('/api/verification', verificationRoutes);

// Backup Routes
const backupRoutes = require('./routes/backup');
app.use('/api/backup', backupRoutes);

// Chat History Routes
const chatRoutes = require('./routes/chats');
app.use('/api/chats', chatRoutes);

// Notification Routes
const notificationRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationRoutes);

// Vercel requires exporting the app
module.exports = app;

// Only listen if run directly (local dev)
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
