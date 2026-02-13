const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Sync contacts
// POST /api/contacts/sync
// body: { hashes: ['sha256_hash1', 'sha256_hash2', ...] }
router.post('/sync', auth, async (req, res) => {
    try {
        const { hashes } = req.body;

        if (!hashes || !Array.isArray(hashes)) {
            return res.status(400).json({ message: 'Hashes array is required' });
        }

        // Find users whose hashed phone or hashed email matches any in the list
        const matchedUsers = await User.find({
            $or: [
                { hashedPhoneNumber: { $in: hashes } },
                { hashedEmail: { $in: hashes } }
            ]
        }).select('_id displayName publicKey phoneNumber email');

        res.json(matchedUsers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
