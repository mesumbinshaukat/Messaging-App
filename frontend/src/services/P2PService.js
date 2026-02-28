import * as SMS from 'expo-sms';
import BLEMeshService from './BLEMeshService';

class P2PService {
    async sendMessage(encryptedPacket, recipient, messageId) {
        console.log(`[P2P] Attempting delivery to ${recipient.displayName} (ID: ${messageId})`);

        // 1. Try BLE Mesh first
        try {
            const bleSuccess = await BLEMeshService.sendMessageToPeer(recipient._id, encryptedPacket, messageId);
            if (bleSuccess) {
                console.log('[P2P] Delivered via BLE Mesh');
                return true;
            }
        } catch (e) {
            console.log('[P2P] BLE delivery unavailable:', e.message);
        }

        // 2. Fallback to SMS if phone number exists
        if (recipient.phoneNumber) {
            const isAvailable = await SMS.isAvailableAsync();
            if (isAvailable) {
                console.log('[P2P] Sending via SMS fallback...');
                // Format: [PM]:nonce:content
                const smsBody = `[PM]:${encryptedPacket.nonce}:${encryptedPacket.content}`;
                await SMS.sendSMSAsync([recipient.phoneNumber], smsBody);
                return true;
            }
        }

        console.log('[P2P] No offline routes available');
        return false;
    }
}

export default new P2PService();
