import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';

// Initialize PRNG for tweetnacl using expo-crypto
nacl.setPRNG((x, n) => {
    const randomBytes = Crypto.getRandomBytes(n);
    for (let i = 0; i < n; i++) {
        x[i] = randomBytes[i];
    }
});

const PRIVATE_KEY_ALIAS = 'messaging_app_private_key';

/**
 * Generate a new key pair for NaCl.
 */
export const generateKeyPair = async () => {
    const keyPair = nacl.box.keyPair();
    const publicKeyBase64 = encodeBase64(keyPair.publicKey);
    const privateKeyBase64 = encodeBase64(keyPair.secretKey);

    // Store private key securely
    await SecureStore.setItemAsync(PRIVATE_KEY_ALIAS, privateKeyBase64);

    return publicKeyBase64;
};

/**
 * Get the stored private key.
 */
export const getMyPrivateKey = async () => {
    return await SecureStore.getItemAsync(PRIVATE_KEY_ALIAS);
};

/**
 * Encrypt a message for a recipient.
 * @param {string} msg Text message
 * @param {string} recipientPublicKeyBase64 Recipient's public key (Base64)
 */
export const encryptMessage = async (msg, recipientPublicKeyBase64) => {
    console.log('Encrypting message for:', recipientPublicKeyBase64);
    const myPrivateKeyBase64 = await getMyPrivateKey();
    if (!myPrivateKeyBase64) throw new Error('Private key not found');
    console.log('My private key found (length):', myPrivateKeyBase64.length);

    try {
        const myPrivateKey = decodeBase64(myPrivateKeyBase64);
        const recipientPublicKey = decodeBase64(recipientPublicKeyBase64);

        const nonce = nacl.randomBytes(nacl.box.nonceLength);

        // Convert text message to Uint8Array
        const encoder = new TextEncoder();
        const encodedMessage = encoder.encode(msg);

        const encrypted = nacl.box(
            encodedMessage,
            nonce,
            recipientPublicKey,
            myPrivateKey
        );

        return {
            content: encodeBase64(encrypted),
            nonce: encodeBase64(nonce)
        };
    } catch (err) {
        console.error('Encryption internal error:', err);
        throw err;
    }
};

/**
 * Decrypt a message from a sender.
 * @param {string} encryptedBase64 Encrypted message (Base64)
 * @param {string} nonceBase64 Nonce (Base64)
 * @param {string} senderPublicKeyBase64 Sender's public key (Base64)
 */
export const decryptMessage = async (encryptedBase64, nonceBase64, senderPublicKeyBase64) => {
    const myPrivateKeyBase64 = await getMyPrivateKey();
    if (!myPrivateKeyBase64) throw new Error('Private key not found');

    const myPrivateKey = decodeBase64(myPrivateKeyBase64);
    const senderPublicKey = decodeBase64(senderPublicKeyBase64);
    const nonce = decodeBase64(nonceBase64);
    const encrypted = decodeBase64(encryptedBase64);

    const decrypted = nacl.box.open(
        encrypted,
        nonce,
        senderPublicKey,
        myPrivateKey
    );

    if (!decrypted) {
        throw new Error('Failed to decrypt message');
    }

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
};

/**
 * Secretbox encryption for Ratchet (Symmetric)
 */
export const encryptWithRatchet = async (msg, keyBase64) => {
    const key = decodeBase64(keyBase64);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(msg);
    const encrypted = nacl.secretbox(encoded, nonce, key);
    return {
        content: encodeBase64(encrypted),
        nonce: encodeBase64(nonce)
    };
};

export const decryptWithRatchet = async (encryptedBase64, nonceBase64, keyBase64) => {
    const key = decodeBase64(keyBase64);
    const nonce = decodeBase64(nonceBase64);
    const encrypted = decodeBase64(encryptedBase64);
    const decrypted = nacl.secretbox.open(encrypted, nonce, key);
    if (!decrypted) throw new Error('Ratchet decryption failed');
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
};

/**
 * Hash a string (phone/email) for privacy-focused sync.
 */
export const hashForSync = async (text) => {
    return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        text.trim().toLowerCase()
    );
};
