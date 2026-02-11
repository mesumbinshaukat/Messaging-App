const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
    try {
        const { phoneNumber, email, password, publicKey, displayName } = req.body;

        // Check if user already exists
        let user = await User.findOne({ $or: [{ phoneNumber }, { email }] });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Hash for discovery
        const hashedPhoneNumber = crypto.createHash('sha256').update(phoneNumber).digest('hex');
        const hashedEmail = crypto.createHash('sha256').update(email).digest('hex');

        // Create user
        user = new User({
            phoneNumber,
            hashedPhoneNumber,
            email,
            hashedEmail,
            password: hashedPassword,
            publicKey,
            displayName,
        });

        await user.save();

        // Create JWT
        const payload = { userId: user._id };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ token, user: { id: user._id, displayName, phoneNumber, email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { login, password } = req.body; // login can be phoneNumber or email

        // Find user
        const user = await User.findOne({
            $or: [{ phoneNumber: login }, { email: login }]
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create JWT
        const payload = { userId: user._id };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({ token, user: { id: user._id, displayName: user.displayName, phoneNumber: user.phoneNumber, email: user.email, publicKey: user.publicKey } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Sync Contacts (Hashed Discovery)
router.post('/sync-contacts', async (req, res) => {
    try {
        const { contactHashes } = req.body;

        if (!contactHashes || !Array.isArray(contactHashes)) {
            return res.status(400).json({ message: 'contactHashes array is required' });
        }

        // Find users whose hashed phone/email matches
        const users = await User.find({
            $or: [
                { hashedPhoneNumber: { $in: contactHashes } },
                { hashedEmail: { $in: contactHashes } }
            ]
        }).select('_id displayName publicKey');

        res.json(users);
    } catch (err) {
        console.error('Sync contacts error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
