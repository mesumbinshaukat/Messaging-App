import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

const PM_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
const MSG_CHAR_UUID = '12345678-1234-5678-1234-56789abcdef1';
const PRESENCE_CHAR_UUID = '12345678-1234-5678-1234-56789abcdef2';
const MAX_BLE_MTU = 512; // bytes per chunk

class BLEMeshService {
  constructor() {
    this.manager = new BleManager();
    this.connectedPeers = new Map(); // deviceId -> { device, userId, publicKey }
    this.messageHandlers = [];
    this.isScanning = false;
    this.messageQueue = new Map(); // messageId -> chunks for reassembly
  }

  async initialize(myUserId, myPublicKey) {
    this.myUserId = myUserId;
    this.myPublicKey = myPublicKey;
    
    // Check BLE state
    try {
      const state = await this.manager.state();
      if (state !== 'PoweredOn') {
        this.manager.onStateChange((newState) => {
          if (newState === 'PoweredOn') this.startMesh();
        }, true);
      } else {
        await this.startMesh();
      }
    } catch (e) {
      console.log('BLE Init error:', e.message);
    }
  }

  async startMesh() {
    this.startScanning();
    // Advertising requires a different native module (react-native-ble-advertiser)
    // which is not typically bundled with ble-plx.
  }

  startScanning() {
    if (this.isScanning) return;
    this.isScanning = true;
    
    this.manager.startDeviceScan([PM_SERVICE_UUID], { allowDuplicates: false }, async (error, device) => {
      if (error) {
        console.error('BLE scan error:', error);
        this.isScanning = false;
        setTimeout(() => this.startScanning(), 5000);
        return;
      }
      
      if (device && !this.connectedPeers.has(device.id)) {
        try {
          await this.connectToPeer(device);
        } catch (e) {
          console.log('Failed to connect to peer:', e.message);
        }
      }
    });
  }

  async connectToPeer(device) {
    const connected = await device.connect({ timeout: 10000 });
    await connected.discoverAllServicesAndCharacteristics();
    
    // Read presence characteristic to get userId + publicKey
    const presenceChar = await connected.readCharacteristicForService(PM_SERVICE_UUID, PRESENCE_CHAR_UUID);
    const presenceData = JSON.parse(Buffer.from(presenceChar.value, 'base64').toString('utf8'));
    
    this.connectedPeers.set(device.id, {
      device: connected,
      userId: presenceData.userId,
      publicKey: presenceData.publicKey,
    });
    
    // Subscribe to incoming messages
    connected.monitorCharacteristicForService(PM_SERVICE_UUID, MSG_CHAR_UUID, (error, char) => {
      if (error) return;
      const chunk = JSON.parse(Buffer.from(char.value, 'base64').toString('utf8'));
      this.handleIncomingChunk(chunk, presenceData.userId, presenceData.publicKey);
    });
    
    connected.onDisconnected(() => {
      this.connectedPeers.delete(device.id);
    });
  }

  handleIncomingChunk(chunk, senderUserId, senderPublicKey) {
    const { messageId, chunkIndex, totalChunks, data } = chunk;
    
    if (!this.messageQueue.has(messageId)) {
      this.messageQueue.set(messageId, new Array(totalChunks));
    }
    
    this.messageQueue.get(messageId)[chunkIndex] = data;
    
    const chunks = this.messageQueue.get(messageId);
    if (chunks.every(c => c !== undefined)) {
      const fullPayload = JSON.parse(chunks.join(''));
      this.messageQueue.delete(messageId);
      
      this.messageHandlers.forEach(handler => handler({
        type: 'ble_message',
        senderId: senderUserId,
        senderPublicKey,
        ...fullPayload
      }));
    }
  }

  async sendMessageToPeer(targetUserId, encryptedPacket, messageId) {
    const peer = [...this.connectedPeers.values()].find(p => p.userId === targetUserId);
    if (!peer) throw new Error('Peer not connected via BLE');
    
    const payload = JSON.stringify({
      content: encryptedPacket.content,
      nonce: encryptedPacket.nonce,
      messageId,
      timestamp: new Date().toISOString(),
    });
    
    const chunkSize = MAX_BLE_MTU - 100;
    const totalChunks = Math.ceil(payload.length / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const chunk = JSON.stringify({
        messageId,
        chunkIndex: i,
        totalChunks,
        data: payload.slice(i * chunkSize, (i + 1) * chunkSize),
      });
      
      const base64Chunk = Buffer.from(chunk, 'utf8').toString('base64');
      
      await peer.device.writeCharacteristicWithResponseForService(
        PM_SERVICE_UUID,
        MSG_CHAR_UUID,
        base64Chunk
      );
      
      await new Promise(r => setTimeout(r, 50));
    }
    
    return true;
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  destroy() {
    this.manager.stopDeviceScan();
    this.connectedPeers.forEach(peer => peer.device.cancelConnection());
    this.connectedPeers.clear();
    this.manager.destroy();
  }
}

export default new BLEMeshService();
