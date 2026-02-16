import { Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import * as SMS from 'expo-sms';
import { requestP2PPermissions } from '../utils/permissions';

const SERVICE_UUID = '0000180D-0000-1000-8000-00805F9B34FB';

class P2PService {
    constructor() {
        this.manager = new BleManager();
        this.peers = new Map();
        this.mode = 'ONLINE';
    }

    async initialize() {
        if (Platform.OS !== 'android') return;

        const hasPermissions = await requestP2PPermissions();
        if (!hasPermissions) return;

        console.log('Initializing P2P Service...');
        this.startBLEScan();
    }

    startBLEScan() {
        this.manager.startDeviceScan([SERVICE_UUID], null, (error, device) => {
            if (error) {
                console.log('BLE Scan error:', error);
                return;
            }

            if (device.name && !this.peers.has(device.id)) {
                console.log('Found Peer:', device.name, device.id);
                this.peers.set(device.id, device);
            }
        });
    }

    async sendMessage(message, recipient) {
        console.log(`Sending P2P/SMS to ${recipient.displayName}`);

        // 1. Try BLE (Placeholder for now, as connection logic is complex)
        // In a real app, we would connect to the device.id here

        // 2. Fallback to SMS (Signal)
        if (recipient.phoneNumber) {
            const isAvailable = await SMS.isAvailableAsync();
            if (isAvailable) {
                console.log('Sending via SMS fallback...');
                await SMS.sendSMSAsync(
                    [recipient.phoneNumber],
                    `[PM_MSG]:${JSON.stringify(message)}`
                );
                return true;
            }
        }

        throw new Error('No P2P route available and SMS not supported');
    }
}

export default new P2PService();
