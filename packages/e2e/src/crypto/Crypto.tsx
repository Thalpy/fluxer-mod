/*
 * Core cryptographic primitives for E2E encryption.
 * Uses Web Crypto API (available in both browser and Node.js 20+)
 * 
 * Algorithms:
 * - X25519 for key exchange (ECDH)
 * - AES-256-GCM for symmetric encryption
 */

const AES_GCM_ALGORITHM = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 128;

export interface E2EKeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicKeyBase64: string;
}

export interface EncryptedPayload {
  ciphertext: string;  // Base64
  iv: string;          // Base64
  version: 1;          // For future format changes
}

// ============================================
// Utility functions
// ============================================

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binaryString = '';
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}

function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

// ============================================
// Key generation and exchange
// ============================================

/**
 * Generate a new X25519 key pair for key exchange.
 */
export async function generateKeyPair(): Promise<E2EKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'X25519' },
    true,  // extractable
    ['deriveBits']
  ) as CryptoKeyPair;

  const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyBase64 = arrayBufferToBase64(rawPublicKey);

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicKeyBase64,
  };
}

/**
 * Import a public key from base64 for key exchange.
 */
export async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(publicKeyBase64);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'X25519' },
    true,
    []
  );
}

/**
 * Derive a shared secret from our private key and their public key.
 * Returns an AES-GCM key ready for encryption/decryption.
 */
export async function deriveSharedSecret(
  ourPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<CryptoKey> {
  const sharedBits = await crypto.subtle.deriveBits(
    {
      name: 'X25519',
      public: theirPublicKey,
    },
    ourPrivateKey,
    256
  );

  return await crypto.subtle.importKey(
    'raw',
    sharedBits,
    { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
    false,  // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a random symmetric key for channel encryption.
 * Used for group channels where we share a single key.
 */
export async function generateSymmetricKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
    true,  // extractable (so we can share it)
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a symmetric key to base64 for storage/sharing.
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(raw);
}

/**
 * Import a symmetric key from base64.
 */
export async function importSymmetricKey(keyBase64: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(keyBase64);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: AES_GCM_ALGORITHM, length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// ============================================
// Encryption / Decryption
// ============================================

/**
 * Encrypt plaintext with a symmetric key.
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedPayload> {
  const iv = generateIV();
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: AES_GCM_ALGORITHM,
      iv: iv,
      tagLength: AUTH_TAG_LENGTH,
    },
    key,
    encoded
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    version: 1,
  };
}

/**
 * Decrypt ciphertext with a symmetric key.
 */
export async function decrypt(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<string> {
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);
  const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));

  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: AES_GCM_ALGORITHM,
      iv: iv,
      tagLength: AUTH_TAG_LENGTH,
    },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintextBuffer);
}

// ============================================
// Helpers
// ============================================

/**
 * Check if Web Crypto is available.
 */
export function isWebCryptoAvailable(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.generateKey === 'function'
  );
}
