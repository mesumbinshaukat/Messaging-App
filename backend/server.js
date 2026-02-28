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
const rateLimit = require('express-rate-limit');

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Brute force protection: 10 attempts per 15 mins
    message: { error: 'Too many login/register attempts, please try again later.' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

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

            // Keep-alive handling
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
                return;
            }

            if (data.type === 'typing') {
                wss.clients.forEach((client) => {
                    if (client.userId === data.recipientId && client.readyState === 1) {
                        client.send(JSON.stringify({
                            type: 'typing',
                            senderId: ws.userId,
                            isTyping: data.isTyping
                        }));
                    }
                });
                return;
            }

            if (!currentUserId) {
                return ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            }

            // Message Relay
            if (data.type === 'chat_message') {
                const { recipientId, content, nonce, messageId, timestamp } = data;

                // SEC-2: Server-side validation
                if (!content || typeof content !== 'string' || !nonce || nonce.length !== 32) {
                    console.error(`[SEC-VULN] Message ${messageId}: Invalid payload format from ${currentUserId}`);
                    return;
                }

                // SEC-4: Metadata Minimization (Minute precision)
                const now = new Date();
                const minuteTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());

                console.log(`[DEBUG] Message ${messageId} received from ${currentUserId} for ${recipientId}`);

                if (!content || !nonce) {
                    console.log(`[DEBUG] Message ${messageId} FAILED: Missing content or nonce`);
                    return ws.send(JSON.stringify({ type: 'error', message: 'Missing content or nonce' }));
                }

                // PERSISTENCE: Save to MongoDB (Encrypted blob)
                console.log(`[DEBUG] Message ${messageId}: Saving to MongoDB...`);
                const newMessage = new Message({
                    senderId: currentUserId,
                    recipientId: recipientId,
                    content: content,
                    nonce: nonce,
                    messageId: messageId,
                    timestamp: minuteTimestamp,
                    status: 'pending' // For SEC-4: server identifies undelivered
                });
                await newMessage.save()
                    .then(() => console.log(`[DEBUG] Message ${messageId}: Saved to DB successfully`))
                    .catch(err => console.error(`[DEBUG] Message ${messageId} DB SAVE FAIL:`, err));

                // Construct message to relay
                const relayData = JSON.stringify({
                    type: 'chat_message',
                    senderId: currentUserId,
                    content,
                    nonce,
                    messageId,
                    timestamp: minuteTimestamp
                });

                // Send to all recipient's active connections
                let recipientIsOnline = false;
                if (clients.has(recipientId)) {
                    const recipientClients = clients.get(recipientId);
                    console.log(`[DEBUG] Message ${messageId}: Attempting relay to ${recipientClients.size} active connections for ${recipientId}`);

                    recipientClients.forEach(client => {
                        if (client.readyState === 1) { // WebSocket.OPEN = 1
                            client.send(relayData);
                            relayed = true;
                            console.log(`[DEBUG] Message ${messageId}: Relay sent to connection`);
                        } else {
                            console.log(`[DEBUG] Message ${messageId}: Skipping relay - connection state is ${client.readyState}`);
                        }
                    });

                    if (relayed) {
                        // SEC-4: Auto-delete delivered messages (Phase 2: Use TTL or background cleanup)
                        // For now, mark as delivered so cleanup script knows
                        await Message.updateOne({ messageId }, { $set: { status: 'delivered' } });
                    }
                } else {
                    console.log(`[DEBUG] Message ${messageId}: Recipient ${recipientId} is OFFLINE (No active WS connections)`);
                }

                recipientIsOnline = relayed;

                // Delivery Acknowledgement
                ws.send(JSON.stringify({
                    type: 'delivery_ack',
                    messageId: messageId,
                    status: recipientIsOnline ? 'delivered' : 'sent'
                }));

                // PUSH NOTIFICATION: Send even if online (to ensure alert)
                try {
                    const recipientUser = await User.findById(recipientId);
                    if (recipientUser && recipientUser.pushToken && Expo.isExpoPushToken(recipientUser.pushToken)) {
                        console.log(`[DEBUG] Message ${messageId}: Triggering Push Notification to ${recipientUser.pushToken}`);
                        const senderUser = await User.findById(currentUserId);
                        await expo.sendPushNotificationsAsync([{
                            to: recipientUser.pushToken,
                            sound: 'default',
                            title: senderUser ? senderUser.displayName : 'New Message',
                            body: 'You have a new encrypted message',
                            data: { senderId: currentUserId, type: 'chat_message' },
                        }]);
                        console.log(`[DEBUG] Message ${messageId}: Push notification sent successfully`);
                    } else {
                        console.log(`[DEBUG] Message ${messageId}: No valid push token for ${recipientId}`);
                    }
                } catch (pushErr) {
                    console.error(`[DEBUG] Message ${messageId} PUSH FAIL:`, pushErr);
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

// Health check for Render keep-alive
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
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

// SEC-4: Cleanup delivered messages
app.post('/api/admin/cleanup', async (req, res) => {
    // Only allow if specific secret is provided (for cron)
    if (req.headers['x-cleanup-secret'] !== process.env.JWT_SECRET) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const result = await Message.deleteMany({
            $or: [
                { status: 'delivered' }, // Delete if delivered
                { timestamp: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Or if older than 24h
            ]
        });
        res.json({ deletedCount: result.deletedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Vercel requires exporting the app
module.exports = app;

// Only listen if run directly (local dev)
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
