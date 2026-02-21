/*
 * Tests for E2EManager - the main integration tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { E2EManager } from '../src/E2EManager';
import { KeyStore } from '../src/store/KeyStore';
import { isE2EMessage } from '../src/crypto/MessageFormat';

describe('E2EManager', () => {
  let manager: E2EManager;

  beforeEach(async () => {
    // Use in-memory store for tests
    const keyStore = KeyStore.createMemoryStore();
    manager = new E2EManager(keyStore);
    await manager.initialize();
  });

  describe('Channel E2E Configuration', () => {
    it('channels are not secure by default', () => {
      expect(manager.isSecureChannel('channel-123')).toBe(false);
    });

    it('can enable E2E for a channel', async () => {
      await manager.enableE2E('channel-123');
      expect(manager.isSecureChannel('channel-123')).toBe(true);
    });

    it('can disable E2E for a channel', async () => {
      await manager.enableE2E('channel-123');
      await manager.disableE2E('channel-123');
      expect(manager.isSecureChannel('channel-123')).toBe(false);
    });

    it('returns list of secure channels', async () => {
      await manager.enableE2E('channel-1');
      await manager.enableE2E('channel-2');
      await manager.enableE2E('channel-3');

      const channels = manager.getSecureChannels();
      expect(channels).toContain('channel-1');
      expect(channels).toContain('channel-2');
      expect(channels).toContain('channel-3');
      expect(channels).toHaveLength(3);
    });
  });

  describe('Message Encryption', () => {
    it('encrypts message for secure channel', async () => {
      const channelId = 'secure-channel';
      await manager.enableE2E(channelId);

      const plaintext = 'Secret message';
      const encrypted = await manager.encryptMessage(channelId, plaintext);

      // Should be wrapped E2E format
      expect(isE2EMessage(encrypted)).toBe(true);
      
      // Should not contain plaintext
      expect(encrypted).not.toContain(plaintext);
    });

    it('encrypted messages can be decrypted', async () => {
      const channelId = 'secure-channel';
      await manager.enableE2E(channelId);

      const plaintext = 'Hello, secure world! 🔐';
      const encrypted = await manager.encryptMessage(channelId, plaintext);
      
      const processed = await manager.processMessage(channelId, encrypted);

      expect(processed.content).toBe(plaintext);
      expect(processed.isEncrypted).toBe(true);
      expect(processed.error).toBeUndefined();
    });

    it('non-E2E messages pass through unchanged', async () => {
      const plaintext = 'Normal message';
      const processed = await manager.processMessage('any-channel', plaintext);

      expect(processed.content).toBe(plaintext);
      expect(processed.isEncrypted).toBe(false);
    });

    it('handles unicode and emoji', async () => {
      const channelId = 'unicode-test';
      await manager.enableE2E(channelId);

      const plaintext = '👋 Hello 世界 مرحبا 🎉';
      const encrypted = await manager.encryptMessage(channelId, plaintext);
      const processed = await manager.processMessage(channelId, encrypted);

      expect(processed.content).toBe(plaintext);
    });

    it('rejects messages that are too long', async () => {
      const channelId = 'length-test';
      await manager.enableE2E(channelId);

      const tooLong = 'A'.repeat(manager.getMaxMessageLength() + 100);

      await expect(manager.encryptMessage(channelId, tooLong))
        .rejects.toThrow(/too long/i);
    });
  });

  describe('DM Encryption', () => {
    it('encrypts DM when auto-encrypt is enabled', async () => {
      manager.setAutoEncryptDMs(true);
      
      const dmChannelId = 'dm-123';
      expect(manager.isSecureDM(dmChannelId)).toBe(true);

      const plaintext = 'Private DM';
      const encrypted = await manager.encryptDM(dmChannelId, plaintext);
      
      expect(isE2EMessage(encrypted)).toBe(true);
    });
  });

  describe('Cross-Instance Compatibility', () => {
    it('encrypted messages have recognizable fallback', async () => {
      const channelId = 'compat-test';
      await manager.enableE2E(channelId);

      const encrypted = await manager.encryptMessage(channelId, 'Secret');

      // Non-E2E clients should see something user-friendly
      expect(encrypted).toContain('🔒');
      expect(encrypted).toContain('encrypted');
    });

    it('decryption fails gracefully without key', async () => {
      const channelId = 'no-key-test';
      
      // Create encrypted message with one manager
      const keyStore1 = KeyStore.createMemoryStore();
      const manager1 = new E2EManager(keyStore1);
      await manager1.initialize();
      await manager1.enableE2E(channelId);
      const encrypted = await manager1.encryptMessage(channelId, 'Secret');

      // Try to decrypt with different manager (no key)
      const keyStore2 = KeyStore.createMemoryStore();
      const manager2 = new E2EManager(keyStore2);
      await manager2.initialize();

      const processed = await manager2.processMessage(channelId, encrypted);

      expect(processed.isEncrypted).toBe(true);
      expect(processed.error).toBeDefined();
      expect(processed.content).toContain('🔒');
    });
  });

  describe('Key Sharing', () => {
    it('exports and imports keys correctly', async () => {
      const channelId = 'shared-channel';

      // User A creates channel and encrypts message
      const keyStoreA = KeyStore.createMemoryStore();
      const managerA = new E2EManager(keyStoreA);
      await managerA.initialize();
      await managerA.enableE2E(channelId);
      
      const plaintext = 'Shared secret message';
      const encrypted = await managerA.encryptMessage(channelId, plaintext);

      // User A exports key
      const exportedKey = await managerA.exportKey(channelId);
      expect(exportedKey).not.toBeNull();

      // User B imports key
      const keyStoreB = KeyStore.createMemoryStore();
      const managerB = new E2EManager(keyStoreB);
      await managerB.initialize();
      
      const importResult = await managerB.importKey(exportedKey!);
      expect(importResult.success).toBe(true);
      expect(importResult.channelId).toBe(channelId);

      // User B can now decrypt
      const processed = await managerB.processMessage(channelId, encrypted);
      expect(processed.content).toBe(plaintext);
      expect(processed.error).toBeUndefined();
    });

    it('rejects invalid key imports', async () => {
      const result1 = await manager.importKey('not-base64!!!');
      expect(result1.success).toBe(false);

      const result2 = await manager.importKey(btoa('not json'));
      expect(result2.success).toBe(false);

      const result3 = await manager.importKey(btoa('{"wrong": "format"}'));
      expect(result3.success).toBe(false);
    });
  });

  describe('Clear / Logout', () => {
    it('clears all E2E data', async () => {
      await manager.enableE2E('channel-1');
      await manager.enableE2E('channel-2');
      manager.setAutoEncryptDMs(true);

      await manager.clear();

      expect(manager.isSecureChannel('channel-1')).toBe(false);
      expect(manager.isSecureChannel('channel-2')).toBe(false);
      expect(manager.getSecureChannels()).toHaveLength(0);
    });
  });
});
