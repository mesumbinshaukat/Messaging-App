const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
    },
    hashedPhoneNumber: {
        type: String,
        unique: true,
        index: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    hashedEmail: {
        type: String,
        unique: true,
        index: true,
    },
    password: {
        type: String,
        required: true,
    },
    publicKey: {
        type: String, // Store client-generated RSA/NaCl public key
        required: true,
    },
    displayName: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('User', UserSchema);
