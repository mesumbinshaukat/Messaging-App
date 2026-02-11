require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('./models/User');

const nacl = require('tweetnacl');
const { encodeBase64 } = require('tweetnacl-util');

// Generate a valid key pair for demo user
const keyPair = nacl.box.keyPair();
const publicKey = encodeBase64(keyPair.publicKey);
const privateKey = encodeBase64(keyPair.secretKey);

// Demo user credentials
const DEMO_USER = {
    displayName: 'Demo User',
    phoneNumber: '+1234567890',
    email: 'demo@example.com',
    password: 'demo123',
    publicKey: publicKey,
    privateKey: privateKey // Store this if needed for testing decryption later
};

async function createDemoUser() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check if demo user already exists
        let user = await User.findOne({ email: DEMO_USER.email });
        if (user) {
            console.log('Demo user already exists, updating keys...');
            user.publicKey = DEMO_USER.publicKey;
            await user.save();
            console.log('✅ Demo user public key updated successfully!');
            console.log('Email:', DEMO_USER.email);
            console.log('Password:', DEMO_USER.password);
            process.exit(0);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(DEMO_USER.password, salt);

        // Hash for discovery
        const hashedPhoneNumber = crypto.createHash('sha256').update(DEMO_USER.phoneNumber).digest('hex');
        const hashedEmail = crypto.createHash('sha256').update(DEMO_USER.email).digest('hex');

        // Create demo user
        user = new User({
            phoneNumber: DEMO_USER.phoneNumber,
            hashedPhoneNumber,
            email: DEMO_USER.email,
            hashedEmail,
            password: hashedPassword,
            publicKey: DEMO_USER.publicKey,
            displayName: DEMO_USER.displayName,
        });

        await user.save();

        console.log('✅ Demo user created successfully!');
        console.log('-----------------------------------');
        console.log('Display Name:', DEMO_USER.displayName);
        console.log('Email:', DEMO_USER.email);
        console.log('Phone:', DEMO_USER.phoneNumber);
        console.log('Password:', DEMO_USER.password);
        console.log('-----------------------------------');
        console.log('You can now add this user\'s phone or email to your contacts and sync!');

        process.exit(0);
    } catch (err) {
        console.error('Error creating demo user:', err);
        process.exit(1);
    }
}

createDemoUser();
