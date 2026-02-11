const express = require('express');
const router = express.Router();
const { sendEmail, generateOTP } = require('../utils/smtp');

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

// Send OTP to email
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const otp = generateOTP();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

        // Store OTP with expiration
        otpStore.set(email, { otp, expiresAt, attempts: 0 });

        // Send OTP via in-house SMTP
        await sendEmail(
            email,
            'Your Verification Code',
            `Your OTP is: ${otp}\n\nThis code will expire in 5 minutes.`
        );

        res.json({ message: 'OTP sent successfully' });
    } catch (err) {
        console.error('Send OTP error:', err);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        const stored = otpStore.get(email);

        if (!stored) {
            return res.status(400).json({ message: 'No OTP found for this email' });
        }

        // Check expiration
        if (Date.now() > stored.expiresAt) {
            otpStore.delete(email);
            return res.status(400).json({ message: 'OTP has expired' });
        }

        // Check attempts (max 3)
        if (stored.attempts >= 3) {
            otpStore.delete(email);
            return res.status(400).json({ message: 'Too many failed attempts' });
        }

        // Verify OTP
        if (stored.otp !== otp) {
            stored.attempts++;
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Success - remove OTP
        otpStore.delete(email);
        res.json({ message: 'OTP verified successfully', verified: true });
    } catch (err) {
        console.error('Verify OTP error:', err);
        res.status(500).json({ message: 'Failed to verify OTP' });
    }
});

module.exports = router;
