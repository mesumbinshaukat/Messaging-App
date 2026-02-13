const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT
const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// Get messages for a specific chat
router.get('/:recipientId', auth, async (req, res) => {
    try {
        const messages = await Message.find({
            $or: [
                { senderId: req.user.userId, recipientId: req.params.recipientId },
                { senderId: req.params.recipientId, recipientId: req.user.userId }
            ]
        }).sort({ timestamp: 1 }).limit(100);

        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
