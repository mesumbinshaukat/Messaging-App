# PM - Ultra Private & Encrypted

A private, E2E encrypted messaging application built with React Native (Expo) and Node.js.

## Features
- **End-to-End Encryption**: NaCl-based encryption (tweetnacl) with device-generated keys.
- **Privacy-Focused Contact Sync**: Uses SHA-256 hashes to discover contacts without uploading cleartext data.
- **In-house SMTP**: Verification emails sent directly via raw sockets.
- **Hybrid Transport**: WebSocket relay for online use; infrastructure ready for P2P/Mesh (Bluetooth/WiFi).

## Local Development Setup

### Requirement
- **Node.js** v22+
- **MongoDB** (Local instance, default port 27017)
- **Expo Go** (On Android device)

### Backend
1. `cd backend`
2. `npm install`
3. Create `.env` (already provided for local):
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/messaging_app
   JWT_SECRET=your_secret
   ```
4. `node server.js`

### Frontend
1. `cd frontend`
2. `npm install`
3. Update `API_BASE_URL` in `src/utils/api.js` to your computer's local IP.
4. `npx expo start`
5. Scan QR code with Expo Go.

## Hosting on Hostinger (Shared Hosting)

Hostinger shared hosting does not support `pm2` or custom system services. Follow these steps:

### What to Upload
1. The entire `backend` directory (excluding `node_modules`).
2. Run `npm install` via SSH (if available) or upload local `node_modules`.

### Deployment Instructions
1. **Node.js App**: Hostinger's "Node.js Selector" or the Node.js menu allows you to point to `server.js`.
2. **MongoDB**: Since Hostinger shared hosting lacks MongoDB, use **MongoDB Atlas** (Free Tier) and update `MONGODB_URI` in `.env`.
3. **WebSockets**: If Hostinger blocks port 5000/WebSockets, the app will fail to relay messages in real-time. Use a VPS for full compatibility.
4. **No sudo/pm2**: The Node.js application is managed by Hostinger's environment. Ensure your `package.json` has a `"start": "node server.js"` script.

### Server Upload
Upload files to `public_html/api` or a subdomain folder using FTP or the Hostinger File Manager.

### Android App Build Command (APK)
`eas build -p android --profile preview`

### Instant Content Sync
`eas update --branch preview --message "Your update description"`