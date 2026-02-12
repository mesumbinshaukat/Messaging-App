require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('ws');

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

// MongoDB Connection
let isConnected = false;
const connectToDatabase = async () => {
    if (isConnected) {
        console.log('Using existing MongoDB connection');
        return;
    }
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        isConnected = true;
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
};

// Connect immediately for local dev, or lazy load for Vercel
if (process.env.NODE_ENV !== 'production') {
    connectToDatabase();
} else {
    // For Vercel, we might want to connect inside the request handler or just let the global scope handle it (it persists in warm lambdas)
    connectToDatabase();
}

// ... (Rest of the file remains same, but we need to change how we listen)

const jwt = require('jsonwebtoken');

// Client connection mapping: userId -> Set of WebSocket connections
const clients = new Map();

// WebSocket handling
wss.on('connection', (ws) => {
    console.log('New WebSocket connection attempt');
    let currentUserId = null;

    ws.on('message', (message) => {
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
                const { recipientId, content, messageId, timestamp } = data;

                // Construct message to relay
                const relayData = JSON.stringify({
                    type: 'chat_message',
                    senderId: currentUserId,
                    content,
                    messageId,
                    timestamp
                });

                // Send to all recipient's active connections
                if (clients.has(recipientId)) {
                    clients.get(recipientId).forEach(client => {
                        if (client.readyState === ws.OPEN) {
                            client.send(relayData);
                        }
                    });
                } else {
                    // TODO: Handle offline message (store in DB)
                    console.log(`Recipient ${recipientId} is offline`);
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

// Vercel requires exporting the app
module.exports = app;

// Only listen if run directly (local dev)
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
