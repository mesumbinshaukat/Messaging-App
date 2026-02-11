import * as FileSystem from 'expo-file-system';
import { encryptMessage } from './crypto';

export const uploadMedia = async (uri, recipientPublicKey) => {
    try {
        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // Encrypt the base64 data
        const encrypted = await encryptMessage(base64, recipientPublicKey);

        // In a real implementation, you would upload to your server here
        // For now, we'll return the encrypted data
        return {
            type: 'media',
            encrypted: encrypted,
            uri: uri // Keep original URI for local display
        };
    } catch (error) {
        console.error('Media upload failed:', error);
        throw error;
    }
};

export const compressImage = async (uri) => {
    // Placeholder for image compression
    // In production, use expo-image-manipulator
    return uri;
};
