/*
 * Tests for core crypto primitives.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateKeyPair,
  generateSymmetricKey,
  deriveSharedSecret,
  importPublicKey,
  exportKey,
  importSymmetricKey,
  encrypt,
  decrypt,
  isWebCryptoAvailable,
} from '../src/crypto/Crypto';

describe('Crypto Primitives', () => {
  beforeAll(() => {
    expect(isWebCryptoAvailable()).toBe(true);
  });

  describe('Key Generation', () => {
    it('generates unique X25519 key pairs', async () => {
      const keyPair1 = await generateKeyPair();
      const keyPair2 = await generateKeyPair();

      expect(keyPair1.publicKeyBase64).toBeDefined();
      expect(keyPair2.publicKeyBase64).toBeDefined();
      expect(keyPair1.publicKeyBase64).not.toBe(keyPair2.publicKeyBase64);
    });

    it('generates unique symmetric keys', async () => {
      const key1 = await generateSymmetricKey();
      const key2 = await generateSymmetricKey();

      const exported1 = await exportKey(key1);
      const exported2 = await exportKey(key2);

      expect(exported1).not.toBe(exported2);
    });

    it('exports and imports symmetric keys correctly', async () => {
      const original = await generateSymmetricKey();
      const exported = await exportKey(original);
      const imported = await importSymmetricKey(exported);

      // Test by encrypting with original, decrypting with imported
      const plaintext = 'Test message';
      const encrypted = await encrypt(plaintext, original);
      const decrypted = await decrypt(encrypted, imported);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Key Exchange', () => {
    it('derives same shared secret from both sides', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();

      const alicePublic = await importPublicKey(alice.publicKeyBase64);
      const bobPublic = await importPublicKey(bob.publicKeyBase64);

      const aliceShared = await deriveSharedSecret(alice.privateKey, bobPublic);
      const bobShared = await deriveSharedSecret(bob.privateKey, alicePublic);

      // Both should be able to decrypt each other's messages
      const plaintext = 'Secret shared message';
      const encryptedByAlice = await encrypt(plaintext, aliceShared);
      const decryptedByBob = await decrypt(encryptedByAlice, bobShared);

      expect(decryptedByBob).toBe(plaintext);
    });
  });

  describe('Encryption / Decryption', () => {
    it('encrypts and decrypts correctly', async () => {
      const key = await generateSymmetricKey();
      const plaintext = 'Hello, secure world!';

      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('ciphertext does not contain plaintext', async () => {
      const key = await generateSymmetricKey();
      const plaintext = 'VISIBLE_SECRET_TEXT';

      const encrypted = await encrypt(plaintext, key);

      expect(encrypted.ciphertext).not.toContain(plaintext);
      expect(encrypted.ciphertext).not.toContain('VISIBLE');
      expect(encrypted.ciphertext).not.toContain('SECRET');
    });

    it('same plaintext produces different ciphertext (random IV)', async () => {
      const key = await generateSymmetricKey();
      const plaintext = 'Same message';

      const encrypted1 = await encrypt(plaintext, key);
      const encrypted2 = await encrypt(plaintext, key);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);

      // But both should decrypt to same plaintext
      expect(await decrypt(encrypted1, key)).toBe(plaintext);
      expect(await decrypt(encrypted2, key)).toBe(plaintext);
    });

    it('fails with wrong key', async () => {
      const key1 = await generateSymmetricKey();
      const key2 = await generateSymmetricKey();
      const plaintext = 'Secret';

      const encrypted = await encrypt(plaintext, key1);

      await expect(decrypt(encrypted, key2)).rejects.toThrow();
    });

    it('fails with tampered ciphertext', async () => {
      const key = await generateSymmetricKey();
      const encrypted = await encrypt('Secret', key);

      // Tamper with ciphertext
      const tampered = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -4) + 'XXXX',
      };

      await expect(decrypt(tampered, key)).rejects.toThrow();
    });

    it('handles empty string', async () => {
      const key = await generateSymmetricKey();
      const plaintext = '';

      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toBe('');
    });

    it('handles unicode and emoji', async () => {
      const key = await generateSymmetricKey();
      const plaintext = '👋 Hello 世界 🔐 مرحبا';

      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });

    it('handles large messages', async () => {
      const key = await generateSymmetricKey();
      const plaintext = 'A'.repeat(5000);

      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);

      expect(decrypted).toBe(plaintext);
    });
  });
});
