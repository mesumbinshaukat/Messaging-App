# P2P Fallback Implementation Guide

## Overview
This document outlines the research and implementation strategy for P2P (Peer-to-Peer) fallback mechanisms using Bluetooth and WiFi-Direct, as specified in the Project Overview.

## Current Status
The messaging app currently operates in a **hybrid model**:
- **Central Server**: Handles registration, contact discovery, and message relay via WebSockets
- **P2P Layer**: Not yet implemented (research phase)

## P2P Technologies

### 1. Bluetooth Low Energy (BLE) Mesh
**Library**: `react-native-ble-manager`

**Use Case**: Direct messaging when users are within ~10 meters

**Implementation Steps**:
1. Install: `npm install react-native-ble-manager`
2. Request Bluetooth permissions in `app.json`:
   ```json
   "android": {
     "permissions": ["BLUETOOTH", "BLUETOOTH_ADMIN", "BLUETOOTH_CONNECT", "BLUETOOTH_SCAN"]
   }
   ```
3. Implement BLE scanning and advertising for peer discovery
4. Establish GATT connections for message exchange
5. Implement multi-hop relay (mesh) for extended range

**Challenges**:
- Expo limitations: BLE requires custom native modules or config plugins
- Battery drain from continuous scanning
- Complex mesh routing algorithms

### 2. WiFi-Direct (WiFi P2P)
**Library**: `react-native-wifi-p2p`

**Use Case**: Direct messaging over WiFi when users are on the same network or within WiFi range

**Implementation Steps**:
1. Install: `npm install react-native-wifi-p2p`
2. Request WiFi permissions in `app.json`:
   ```json
   "android": {
     "permissions": ["ACCESS_WIFI_STATE", "CHANGE_WIFI_STATE", "ACCESS_FINE_LOCATION"]
   }
   ```
3. Create WiFi-Direct groups
4. Establish socket connections between peers
5. Implement message routing and discovery

**Challenges**:
- Requires bare React Native (Expo doesn't natively support WiFi-Direct)
- Group formation can be slow
- Limited to Android (iOS doesn't support WiFi-Direct)

### 3. WebRTC Data Channels
**Library**: `react-native-webrtc`

**Use Case**: P2P data transfer over existing network connections (WiFi/Cellular)

**Implementation Steps**:
1. Install: `npm install react-native-webrtc`
2. Implement signaling server for peer discovery
3. Establish WebRTC data channels
4. Send encrypted messages directly between peers

**Advantages**:
- Works over any network (WiFi, Cellular)
- NAT traversal built-in (STUN/TURN)
- Lower latency than server relay

## Recommended Approach

### Phase 1: WebRTC P2P (Immediate)
Start with WebRTC data channels as they work within Expo's constraints and provide immediate P2P benefits without requiring bare React Native.

### Phase 2: Bluetooth/WiFi-Direct (Future)
If you decide to eject from Expo or use a development build, implement Bluetooth and WiFi-Direct for true offline P2P.

## Fallback Logic
```
1. Try WebRTC P2P (if both users online)
2. Fall back to WebSocket relay (via server)
3. Queue messages locally (if offline)
4. Sync when connection restored
```

## Security Considerations
- All P2P messages must maintain E2E encryption
- Verify peer identity using public keys
- Implement anti-spoofing measures
- Rate limit P2P connections to prevent DoS

## Next Steps
1. Implement WebRTC signaling server
2. Add WebRTC peer connection logic to frontend
3. Test P2P messaging between two devices
4. Implement fallback to server relay
5. Add offline message queuing

## References
- [React Native BLE Manager](https://github.com/innoveit/react-native-ble-manager)
- [React Native WiFi P2P](https://github.com/kirillzyusko/react-native-wifi-p2p)
- [React Native WebRTC](https://github.com/react-native-webrtc/react-native-webrtc)
- [Bitchat Architecture](https://github.com/bitchat-im/bitchat) (Bluetooth mesh reference)
