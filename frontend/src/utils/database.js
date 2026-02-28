import * as SQLite from 'expo-sqlite';

let db = null;

export const initDatabase = async () => {
    try {
        db = await SQLite.openDatabaseAsync('messaging_app.db');

        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                messageId TEXT UNIQUE NOT NULL,
                senderId TEXT NOT NULL,
                recipientId TEXT NOT NULL,
                content TEXT NOT NULL,
                nonce TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                synced INTEGER DEFAULT 0
            );
            
            CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipientId);
            CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(senderId);

            CREATE TABLE IF NOT EXISTS contacts (
                _id TEXT PRIMARY KEY,
                displayName TEXT,
                publicKey TEXT,
                phoneNumber TEXT,
                email TEXT
            );
        `);

        // Migration: Add status column to messages if it doesn't exist
        try {
            await db.execAsync("ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent'");
            console.log("Migration: Added status column to messages table");
        } catch (e) {
            // Already exists
        }

        // Migration: Add transport column to messages if it doesn't exist
        try {
            await db.execAsync("ALTER TABLE messages ADD COLUMN transport TEXT DEFAULT 'websocket'");
            console.log("Migration: Added transport column to messages table");
        } catch (e) {
            // Already exists
        }

        // Migration: Create ratchet_state table if it doesn't exist
        try {
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS ratchet_state (
                    conversationId TEXT PRIMARY KEY,
                    sendChainKey TEXT,
                    receiveChainKey TEXT,
                    sendCount INTEGER DEFAULT 0,
                    receiveCount INTEGER DEFAULT 0,
                    updatedAt TEXT
                );
            `);
            console.log("Migration: Created ratchet_state table");
        } catch (e) {
            console.error('Migration failed for ratchet_state:', e);
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization failed:', error);
    }
};

export const saveMessage = async (message) => {
    try {
        await db.runAsync(
            'INSERT OR REPLACE INTO messages (messageId, senderId, recipientId, content, nonce, timestamp, synced, status, transport) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                message.messageId, 
                message.senderId, 
                message.recipientId, 
                message.content, 
                message.nonce || '', 
                message.timestamp, 
                message.synced ? 1 : 0,
                message.status || 'sent',
                message.transport || 'websocket'
            ]
        );
    } catch (error) {
        console.error('Failed to save message:', error);
    }
};

export const getMessages = async (userId, recipientId) => {
    try {
        const result = await db.getAllAsync(
            'SELECT * FROM messages WHERE (senderId = ? AND recipientId = ?) OR (senderId = ? AND recipientId = ?) ORDER BY timestamp ASC',
            [userId, recipientId, recipientId, userId]
        );
        return result;
    } catch (error) {
        console.error('Failed to get messages:', error);
        return [];
    }
};

export const markAsSynced = async (messageId) => {
    try {
        await db.runAsync('UPDATE messages SET synced = 1 WHERE messageId = ?', [messageId]);
    } catch (error) {
        console.error('Failed to mark message as synced:', error);
    }
};

export const getUnsyncedMessages = async () => {
    try {
        const result = await db.getAllAsync('SELECT * FROM messages WHERE synced = 0');
        return result;
    } catch (error) {
        console.error('Failed to get unsynced messages:', error);
        return [];
    }
};
export const saveContact = async (contact) => {
    try {
        await db.runAsync(
            'INSERT OR REPLACE INTO contacts (_id, displayName, publicKey, phoneNumber, email) VALUES (?, ?, ?, ?, ?)',
            [contact._id, contact.displayName, contact.publicKey, contact.phoneNumber || '', contact.email || '']
        );
    } catch (error) {
        console.error('Failed to save contact:', error);
    }
};

export const getAllLocalContacts = async () => {
    try {
        const result = await db.getAllAsync('SELECT * FROM contacts');
        return result;
    } catch (error) {
        console.error('Failed to get local contacts:', error);
        return [];
    }
};

export const getRatchetState = async (conversationId) => {
    try {
        return await db.getFirstAsync('SELECT * FROM ratchet_state WHERE conversationId = ?', [conversationId]);
    } catch (error) {
        console.error('Failed to get ratchet state:', error);
        return null;
    }
};

export const saveRatchetState = async (state) => {
    try {
        await db.runAsync(
            'INSERT OR REPLACE INTO ratchet_state (conversationId, sendChainKey, receiveChainKey, updatedAt) VALUES (?, ?, ?, ?)',
            [state.chatId, state.sendChainKey, state.recvChainKey, new Date().toISOString()]
        );
    } catch (error) {
        console.error('Failed to save ratchet state:', error);
    }
};
