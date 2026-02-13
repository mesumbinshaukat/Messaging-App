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

        // Normalize and Hash for discovery
        const normalizedPhone = phoneNumber.trim();
        const normalizedEmail = email.trim().toLowerCase();

        const hashedPhoneNumber = crypto.createHash('sha256').update(normalizedPhone).digest('hex');
        const hashedEmail = crypto.createHash('sha256').update(normalizedEmail).digest('hex');

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
        const normalizedLogin = login.trim().toLowerCase();
        const user = await User.findOne({
            $or: [
                { phoneNumber: login.trim() },
                { email: normalizedLogin }
            ]
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


module.exports = router;
