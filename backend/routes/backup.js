const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Message Backup Schema (E2E encrypted blobs)
const MessageBackupSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    encryptedData: { type: String, required: true }, // E2E encrypted message blob
    timestamp: { type: Date, default: Date.now },
    synced: { type: Boolean, default: true }
});

const MessageBackup = mongoose.model('MessageBackup', MessageBackupSchema);

// Backup encrypted messages to MongoDB
router.post('/backup', async (req, res) => {
    try {
        const { userId, encryptedData } = req.body;

        if (!userId || !encryptedData) {
            return res.status(400).json({ message: 'userId and encryptedData are required' });
        }

        const backup = new MessageBackup({
            userId,
            encryptedData,
            timestamp: new Date()
        });

        await backup.save();
        res.json({ message: 'Backup saved successfully', backupId: backup._id });
    } catch (err) {
        console.error('Backup error:', err);
        res.status(500).json({ message: 'Failed to save backup' });
    }
});

// Retrieve encrypted backups for a user
router.get('/backup/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const backups = await MessageBackup.find({ userId }).sort({ timestamp: -1 });
        res.json({ backups });
    } catch (err) {
        console.error('Retrieve backup error:', err);
        res.status(500).json({ message: 'Failed to retrieve backups' });
    }
});

// Delete old backups (cleanup)
router.delete('/backup/cleanup/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const result = await MessageBackup.deleteMany({
            userId,
            timestamp: { $lt: thirtyDaysAgo }
        });

        res.json({ message: 'Cleanup complete', deletedCount: result.deletedCount });
    } catch (err) {
        console.error('Cleanup error:', err);
        res.status(500).json({ message: 'Failed to cleanup backups' });
    }
});

module.exports = router;
