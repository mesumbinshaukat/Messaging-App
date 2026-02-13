const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const auth = require('../middleware/auth');

router.post('/register', auth, async (req, res) => {
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).json({ message: 'Push token is required' });

    try {
        await User.findByIdAndUpdate(req.userId, { pushToken });
        console.log(`Push token registered for user: ${req.user.userId}`);
        res.json({ message: 'Push token registered successfully' });
    } catch (err) {
        console.error('Error registering push token:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
