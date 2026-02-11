### Project Overview and Feasibility
Building a private, encrypted messaging app for Android using React Native with Expo is feasible, but with caveats. Your requirements emphasize in-house development (no external services like Firebase or Twilio), E2E encryption, multi-transport support (Bluetooth, WiFi, cellular data), and a central server for backups/sync. This resembles apps like Briar or Bitchat (a decentralized P2P app using Bluetooth mesh for offline messaging, no servers/internet/phone numbers, with IRC-style commands and end-to-end encryption via Noise Protocol). However, Bitchat is fully decentralized, while your spec includes a server (MongoDB) and registration/verification, making it a hybrid: central relay for online use, P2P for offline/direct.

Key challenges:
- **Expo Limitations**: Expo simplifies RN development but doesn't natively support low-level Bluetooth/WiFi P2P. You'll need compatible libraries or config plugins; if not, consider ejecting to bare RN (but stick to Expo as requested).
- **In-House Everything**: No third-party services means self-hosting SMTP for email, building an SMS gateway (inspired by httpSMS, an open-source tool that turns an Android phone into an HTTP SMS API using the device's SIM). "Free" SMS relies on your phone's plan (no truly free global SMS without carriers).
- **Security**: Rolling your own crypto is risky—use standard primitives from libraries like expo-crypto. Follow best practices: E2E with forward secrecy, metadata protection, secure key management.
- **Scale**: For you and friends, a simple Node.js server suffices. But P2P mesh (like Bitchat's Bluetooth) is complex; start with central relay and add P2P later.
- **Android-Only**: Focus on Android permissions (e.g., READ_CONTACTS, BLUETOOTH_CONNECT).

Edge cases: Offline queuing, device changes (key rotation), battery drain from P2P, network switches, large media files, spam prevention, legal compliance (e.g., no child exploitation features).

Advanced considerations: Quantum-resistant crypto (e.g., post-quantum key exchange), audit logs, zero-knowledge proofs for verification, federated servers for future expansion, app hardening against reverse engineering.

### Tech Stack
Based on latest research (as of Feb 2026):
- **Frontend**: React Native v0.83 (stable; changelog highlights React 19.2 bump, DevTools improvements, Animated transformOrigin). Use with Expo SDK v54 (stable; SDK 55 beta available but avoid for production—includes RN 0.83.1, better crypto primitives).
- **Backend**: Node.js v22+ (LTS), Express.js for API, MongoDB v8.2 (stable; new features like improved sharding, deprecations in old aggregation ops—use WiredTiger engine).
- **Encryption**: expo-crypto (for random values, hashes), tweetnacl (NaCl-based for public-key crypto—simple, audited). Avoid custom protocols; mimic Signal (double ratchet for forward secrecy).
- **Real-Time**: WebSockets (ws library) for chat sync.
- **P2P**: react-native-wifi-p2p (for WiFi Direct), react-native-ble-manager (for Bluetooth LE mesh). For Expo, use config plugins or wrap in custom modules.
- **Contacts**: expo-contacts (for sync/add/share on Android).
- **SMS/Email**: Custom SMTP sender (nodemailer without external services—use your domain's SMTP). For SMS: Build an in-house gateway like httpSMS (open-source Android app + HTTP API; "free" via your SIM's plan).
- **Database**: MongoDB with encryption at rest (WiredTiger + keyfile), field-level encryption for sensitive data.
- **Other**: react-native-quick-crypto (faster crypto), react-native-webrtc (for potential P2P data channels over WiFi/Bluetooth).

Install via Expo: `npx create-expo-app MyApp --template blank`. Update to latest: `npx expo install react-native@0.83 expo@54`.

### Architecture
- **Hybrid Model**: Central server for registration, contact discovery, message relay (when offline/P2P unavailable), and MongoDB backups. P2P for direct connections (Bluetooth/WiFi) to reduce latency/server load.
  - **Online Flow**: Client → Server (WebSocket) → Recipient (push via FCM if needed, but in-house: use WebSockets polling).
  - **Offline/P2P Flow**: Discover peers via Bluetooth scanning or WiFi Direct group formation; use WebRTC data channels for messaging.
- **Components**:
  - **Frontend (RN Expo)**: Handles UI, crypto, transports.
  - **Backend (Node.js)**: Auth API, MongoDB ops, WebSocket server.
  - **P2P Layer**: Bluetooth mesh (inspired by Bitchat: multi-hop relay) or WiFi P2P groups.
- **Fallbacks**: Try P2P first (Bluetooth if <10m, WiFi if farther); fall to cellular/server. Queue messages offline, retry on connect.

### User Registration and Verification
1. **Registration**: User enters email/phone. Generate RSA key pair on device (using expo-crypto); store private key in expo-secure-store (encrypted storage).
2. **Verification**:
   - **Email**: Use in-house SMTP sender in Node.js (e.g., net.Socket to connect to your domain's SMTP server—no third-party like SendGrid). Send OTP via custom script: `const net = require('net');` to build SMTP client.
   - **SMS**: Build custom gateway like httpSMS: Install an Android app (your own, forked from httpSMS source) on a dedicated phone; expose HTTP API to send SMS via device's SIM. "Free" if your plan allows; else, limited. For verification: Generate OTP, send via gateway API.
3. **Auth**: JWT tokens from server; refresh on device change. Edge: OTP expiration (5min), rate limiting (3 attempts/hr).

Advanced: Zero-trust; use WebAuthn for biometric auth.

### Contact Sync and Discovery
- **Sync**: Use expo-contacts to read Android contacts (request READ_CONTACTS permission). Hash phone/email (SHA-256) and query server for registered users.
- **Manual Add**: Input phone/email (with/without country code—normalize with lib like google-libphonenumber, but in-house: custom parser). Server checks if registered; if not, invite via SMS/email.
- **Discovery**: For P2P, broadcast presence via Bluetooth beacons or WiFi SSDP. Server-assisted for online (query hashed contacts).
- **Async Loading**: Load chats from local storage (expo-file-system) first, then sync with server/MongoDB.
- Edge: Dupe contacts, privacy (hash to avoid leaking non-users), offline add (queue for later verification).

### Messaging and Media
- **Features**: Text, images/videos/files (up to 100MB; compress with expo-image-manipulator).
- **Sync**: Use WebSockets for real-time. Store locally + backup to MongoDB (encrypted blobs).
- **UI**: Mimic WhatsApp: FlatList for chats, bubbles for messages, media previews. Use react-native-gifted-chat or custom.
- **Transports**:
  - **Cellular/Data**: Via server relay.
  - **WiFi P2P**: Form groups with react-native-wifi-p2p; send via sockets.
  - **Bluetooth**: Use react-native-ble-manager for LE connections; mesh by relaying through peers (advanced: flood routing like Bitchat).
  - Other: NFC for ultra-close (expo-nfc), but niche.
- Edge: Media encryption, resumable uploads, thumbnails, expiration (self-destruct messages).

### Encryption and Security
- **E2E**: Hybrid: RSA for key exchange, AES-256 for messages (expo-crypto). Use tweetnacl for public-key ops. Implement double ratchet (like Signal) for forward/post-compromise security.
  - Flow: Sender encrypts with recipient's public key (fetched from server or P2P). Only recipient decrypts.
- **Key Management**: Device-generated; rotate on login/device change. Store in secure-store; backup encrypted to MongoDB.
- **Best Practices**:
  - Encrypt at rest (MongoDB WiredTiger keyfile), in transit (TLS 1.3), in use (field-level encryption).
  - Metadata protection: Anonymize logs, no timestamps in clear.
  - Auth: PBKDF2 for passwords, no plain storage.
  - Audits: Log access; enable MongoDB auditing.
  - Vulnerabilities: Use helmet.js for Express, validate inputs (Joi in-house).
- Edge: MITM (pin certs), key compromise (revocation), quantum (add Kyber-like).

Advanced: Opaque for password auth (zero-knowledge), CRDTs for conflict-free sync.

### Sync and Backups
- **Chats**: Local first (SQLite via expo-sqlite); sync to MongoDB on connect (encrypted docs).
- **Backups**: MongoDB collections: users (hashed), chats (E2E encrypted). Use change streams for real-time.
- Edge: Conflicts (last-write-wins), deletions (soft delete), storage limits (prune old).

### Development Steps
1. **Setup**: Init Expo app, install deps. Setup Node.js server with MongoDB (local/self-hosted).
2. **Backend**: Build API (auth, contacts, WebSockets). Implement SMTP/SMS.
3. **Frontend**: UI components, contact sync, message sending.
4. **Encryption**: Add key gen/exchange.
5. **P2P**: Integrate WiFi/Bluetooth libs (test on real devices).
6. **Testing**: Emulators for basics; physical Androids for P2P. Cover edges: network drops, battery, large groups.
7. **Deployment**: Sideload APK (no Play Store). Self-host server on VPS (e.g., AWS EC2, but in-house: Raspberry Pi).
8. **Monitoring**: Add logs (Winston), error tracking (Sentry self-hosted).

Timeline: 2-4 weeks for MVP (messages only), +2 for P2P/media.

This plan covers your reqs + unmentioned (e.g., offline, security audits). If infeasible (e.g., Expo P2P), consider bare RN. Test thoroughly—security bugs are costly.