# PM - Ultra Private & Encrypted 🛡️

A state-of-the-art private messaging application (rebranded as **PM**) built with React Native (Expo) and Node.js. Designed for total privacy, PM ensures that your messages never leave your device in a readable format.

## 🚀 Key Features

- **End-to-End Encryption (E2E)**: NaCl-based encryption (`tweetnacl`) with device-generated keys. Every message uses a unique cryptographic **nonce** for maximum security.
- **Privacy-Focused Contact Sync**: Discovers contacts using SHA-256 hashing. Your phone book is never uploaded in cleartext.
- **Push Notifications**: Real-time alerts using Expo Push Tokens, designed to maintain privacy by showing generic "New Encrypted Message" alerts.
- **Local Persistence**: Full chat history and manually added contacts are stored securely on-device using **SQLite** (`expo-sqlite`).
- **Hybrid Transport & Fallbacks**: 
    - **Primary**: Real-time WebSocket relay.
    - **Secondary**: Bluetooth Advertising & Scanning (P2P).
    - **Tertiary**: SMS Signal Fallback (sends full encrypted packets over SMS when offline).
- **In-house SMTP**: Secure OTP verification emails sent via raw sockets to avoid third-party email service tracking.

## 🏗️ Technical Architecture

### Security Protocol
1.  **Key Gen**: On first launch, the app generates a 32-byte NaCl keypair. The private key never leaves the device's **SecureStore**.
2.  **Encryption**: Messages are encrypted using the sender's private key and the recipient's public key (`nacl.box`).
3.  **Persistence**: The backend (MongoDB) stores only the encrypted `content`, `nonce`, and metadata. It has **zero knowledge** of your conversations.

### Data Flow
- **Real-time**: WebSocket -> Server Relay -> Push Notification (simultaneous).
- **Offline**: SQLite -> Local Queue -> P2P/SMS Discovery.

## 🛠️ Local Development

### Requirements
- **Node.js** v22+
- **MongoDB** (Local or Atlas)
- **Expo Go** or **EAS Dev Build**

### Setup
1.  **Backend**:
    ```bash
    cd backend
    npm install
    # Set MONGODB_URI and JWT_SECRET in .env
    node server.js
    ```
2.  **Frontend**:
    ```bash
    cd frontend
    npm install
    # Update API_URL in src/utils/api.js
    npx expo start
    ```

## 📦 Deployment & Scaling

### Vercel (Backend)
The backend is optimized for Vercel. Ensure `vercel.json` is configured to handle WebSocket upgrades (though a VPS is recommended for heavy WebSocket traffic).

### Android APK Build
The app uses **EAS (Expo Application Services)** for professional builds:
```bash
# Generate a preview APK with the PM branding and icon
eas build -p android --profile preview
```

### Instant Updates (OTA)
Push critical fixes directly to user devices without a full APK reinstall:
```bash
eas update --branch preview --message "Fixed E2E nonce persistence"
```

---
## 📜 License
Private and Confidential. All rights reserved.