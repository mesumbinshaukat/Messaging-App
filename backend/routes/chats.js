const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');

const auth = require('../middleware/auth');

router.get('/:recipientId', auth, async (req, res) => {
    try {
        const messages = await Message.find({
            $or: [
                { senderId: req.userId, recipientId: req.params.recipientId },
                { senderId: req.params.recipientId, recipientId: req.userId }
            ]
        }).sort({ timestamp: 1 }).limit(100);

        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
