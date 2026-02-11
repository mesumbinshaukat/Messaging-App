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
                timestamp TEXT NOT NULL,
                synced INTEGER DEFAULT 0
            );
            
            CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipientId);
            CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(senderId);
        `);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization failed:', error);
    }
};

export const saveMessage = async (message) => {
    try {
        await db.runAsync(
            'INSERT OR REPLACE INTO messages (messageId, senderId, recipientId, content, timestamp, synced) VALUES (?, ?, ?, ?, ?, ?)',
            [message.messageId, message.senderId, message.recipientId, message.content, message.timestamp, message.synced ? 1 : 0]
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
