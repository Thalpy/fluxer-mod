/*
 * Upstream Compatibility Tests
 * 
 * These tests ensure our E2E layer remains compatible with upstream Fluxer.
 * Run these after merging upstream changes to catch breaking changes early.
 */

import { describe, it, expect } from 'vitest';
import { E2EManager } from '../src/E2EManager';
import { KeyStore } from '../src/store/KeyStore';
import { wrapE2EMessage, isE2EMessage } from '../src/crypto/MessageFormat';
import { encrypt, generateSymmetricKey } from '../src/crypto/Crypto';

describe('Upstream Compatibility', () => {
  describe('Message Format Compatibility', () => {
    it('encrypted message is valid string content', async () => {
      const key = await generateSymmetricKey();
      const payload = await encrypt('Test message', key);
      const wrapped = wrapE2EMessage(payload);

      // Must be a string
      expect(typeof wrapped).toBe('string');
      
      // Must not exceed Fluxer message limit
      expect(wrapped.length).toBeLessThanOrEqual(2000);
      
      // Must not contain null bytes or invalid chars
      expect(wrapped).not.toContain('\x00');
    });

    it('encrypted messages do not break message parsing', async () => {
      const key = await generateSymmetricKey();
      const payload = await encrypt('Test', key);
      const wrapped = wrapE2EMessage(payload);

      // Common string operations should work
      expect(() => wrapped.trim()).not.toThrow();
      expect(() => wrapped.split('\n')).not.toThrow();
      expect(() => JSON.stringify({ content: wrapped })).not.toThrow();
    });

    it('non-E2E messages are unaffected', () => {
      const normalMessages = [
        'Hello world',
        'Message with emoji 👋',
        'Message with @mention',
        'https://example.com',
        '```code block```',
        '> quote',
        '**bold** and *italic*',
      ];

      for (const msg of normalMessages) {
        expect(isE2EMessage(msg)).toBe(false);
      }
    });
  });

  describe('Key Storage Compatibility', () => {
    it('keys can be stored and retrieved across sessions', async () => {
      const keyStore = KeyStore.createMemoryStore();
      const channelId = 'persist-test';

      // Session 1: Create key
      const manager1 = new E2EManager(keyStore);
      await manager1.initialize();
      await manager1.enableE2E(channelId);
      const encrypted = await manager1.encryptMessage(channelId, 'Secret');

      // Session 2: New manager, same store
      const manager2 = new E2EManager(keyStore);
      await manager2.initialize();
      
      // Should be able to decrypt with stored key
      // Note: In real usage, secure channel config is in localStorage
      // Here we manually re-enable to simulate config reload
      await manager2.enableE2E(channelId);
      
      const processed = await manager2.processMessage(channelId, encrypted);
      expect(processed.content).toBe('Secret');
    });
  });

  describe('API Surface Stability', () => {
    it('E2EManager has expected public methods', () => {
      const manager = new E2EManager(KeyStore.createMemoryStore());

      // Core methods that our integration relies on
      expect(typeof manager.initialize).toBe('function');
      expect(typeof manager.enableE2E).toBe('function');
      expect(typeof manager.disableE2E).toBe('function');
      expect(typeof manager.isSecureChannel).toBe('function');
      expect(typeof manager.encryptMessage).toBe('function');
      expect(typeof manager.processMessage).toBe('function');
      expect(typeof manager.exportKey).toBe('function');
      expect(typeof manager.importKey).toBe('function');
    });

    it('processMessage returns expected shape', async () => {
      const manager = new E2EManager(KeyStore.createMemoryStore());
      await manager.initialize();

      const result = await manager.processMessage('channel', 'normal message');

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('isEncrypted');
      expect(typeof result.content).toBe('string');
      expect(typeof result.isEncrypted).toBe('boolean');
    });
  });

  describe('Edge Cases from Upstream', () => {
    it('handles messages that look like E2E but are not', () => {
      const trickMessages = [
        '🔒 Fake encrypted message',
        '[E2E] Not actually encrypted',
        'encrypted\nfake payload',
        '\u200B but not E2E',
      ];

      for (const msg of trickMessages) {
        expect(isE2EMessage(msg)).toBe(false);
      }
    });

    it('handles empty and whitespace messages', async () => {
      const manager = new E2EManager(KeyStore.createMemoryStore());
      await manager.initialize();

      const result1 = await manager.processMessage('channel', '');
      expect(result1.content).toBe('');
      expect(result1.isEncrypted).toBe(false);

      const result2 = await manager.processMessage('channel', '   ');
      expect(result2.content).toBe('   ');
      expect(result2.isEncrypted).toBe(false);
    });

    it('handles very long non-E2E messages', async () => {
      const manager = new E2EManager(KeyStore.createMemoryStore());
      await manager.initialize();

      const longMessage = 'A'.repeat(2000);
      const result = await manager.processMessage('channel', longMessage);
      
      expect(result.content).toBe(longMessage);
      expect(result.isEncrypted).toBe(false);
    });
  });
});
