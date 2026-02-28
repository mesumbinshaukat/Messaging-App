import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import * as Crypto from 'expo-crypto';
import { getRatchetState, saveRatchetState } from './database';

/**
 * Simplified Ratchet for Forward Secrecy.
 * In a full implementation, we'd have Diffie-Hellman ratchets.
 * Here we use a symmetric chain ratchet for Phase 1.
 */

const KDF_SALT = 'pm-messaging-app-ratchet-v1';

async function kdf(key, salt) {
  // In a real app, use HMAC-SHA256. For Phase 1, we use Crypto.digest.
  const input = key + salt;
  const result = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );
  return {
    nextChainKey: result.substring(0, 32),
    messageKey: result.substring(32)
  };
}

export const getNextMessageKey = async (chatId, isSending) => {
  let state = await getRatchetState(chatId);
  
  if (!state) {
    // Initialize with a dummy secret for Phase 1
    state = {
      chatId,
      sendChainKey: 'initial_send_chain_' + chatId,
      recvChainKey: 'initial_recv_chain_' + chatId,
    };
  }

  const currentChainKey = isSending ? state.sendChainKey : state.recvChainKey;
  const { nextChainKey, messageKey } = await kdf(currentChainKey, KDF_SALT);

  // Update state
  if (isSending) {
    state.sendChainKey = nextChainKey;
  } else {
    state.recvChainKey = nextChainKey;
  }
  
  await saveRatchetState(state);
  
  return messageKey;
};
