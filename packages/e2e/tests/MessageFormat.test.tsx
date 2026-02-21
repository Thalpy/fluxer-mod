/*
 * Tests for E2E message format.
 */

import { describe, it, expect } from 'vitest';
import {
  E2E_MESSAGE_PREFIX,
  isE2EMessage,
  wrapE2EMessage,
  unwrapE2EMessage,
  getMaxPlaintextLength,
  type E2EMessageEnvelope,
} from '../src/crypto/MessageFormat';
import type { EncryptedPayload } from '../src/crypto/Crypto';

describe('Message Format', () => {
  const mockPayload: EncryptedPayload = {
    ciphertext: 'dGVzdCBjaXBoZXJ0ZXh0',  // Base64
    iv: 'dGVzdCBpdg==',
    version: 1,
  };

  describe('isE2EMessage', () => {
    it('detects E2E messages', () => {
      const wrapped = wrapE2EMessage(mockPayload);
      expect(isE2EMessage(wrapped)).toBe(true);
    });

    it('rejects normal messages', () => {
      expect(isE2EMessage('Hello world')).toBe(false);
      expect(isE2EMessage('')).toBe(false);
      expect(isE2EMessage('🔒 Fake encrypted')).toBe(false);
    });

    it('rejects partial prefix', () => {
      expect(isE2EMessage('\u200B')).toBe(false);
      expect(isE2EMessage('\u200B\u200B')).toBe(false);
    });
  });

  describe('wrapE2EMessage / unwrapE2EMessage', () => {
    it('wraps and unwraps correctly', () => {
      const wrapped = wrapE2EMessage(mockPayload);
      const unwrapped = unwrapE2EMessage(wrapped);

      expect(unwrapped).not.toBeNull();
      expect(unwrapped!.v).toBe(1);
      expect(unwrapped!.p.ciphertext).toBe(mockPayload.ciphertext);
      expect(unwrapped!.p.iv).toBe(mockPayload.iv);
    });

    it('includes key ID when provided', () => {
      const keyId = 'channel:123:456';
      const wrapped = wrapE2EMessage(mockPayload, keyId);
      const unwrapped = unwrapE2EMessage(wrapped);

      expect(unwrapped!.k).toBe(keyId);
    });

    it('wrapped message contains fallback text', () => {
      const wrapped = wrapE2EMessage(mockPayload);
      
      // Non-E2E clients should see the fallback
      expect(wrapped).toContain('🔒');
      expect(wrapped).toContain('encrypted');
    });

    it('wrapped message stays under 2000 chars for typical payload', () => {
      const wrapped = wrapE2EMessage(mockPayload);
      expect(wrapped.length).toBeLessThan(2000);
    });

    it('returns null for invalid messages', () => {
      expect(unwrapE2EMessage('not encrypted')).toBeNull();
      expect(unwrapE2EMessage('')).toBeNull();
    });

    it('returns null for malformed E2E messages', () => {
      // Has prefix but no payload
      const malformed1 = E2E_MESSAGE_PREFIX + 'no newline';
      expect(unwrapE2EMessage(malformed1)).toBeNull();

      // Has prefix + newline but invalid base64
      const malformed2 = E2E_MESSAGE_PREFIX + 'fallback\n!!!not-base64!!!';
      expect(unwrapE2EMessage(malformed2)).toBeNull();

      // Has prefix + newline + base64 but invalid JSON
      const malformed3 = E2E_MESSAGE_PREFIX + 'fallback\n' + btoa('not json');
      expect(unwrapE2EMessage(malformed3)).toBeNull();

      // Valid JSON but wrong structure
      const malformed4 = E2E_MESSAGE_PREFIX + 'fallback\n' + btoa('{"wrong": "structure"}');
      expect(unwrapE2EMessage(malformed4)).toBeNull();
    });
  });

  describe('getMaxPlaintextLength', () => {
    it('returns a reasonable limit', () => {
      const maxLength = getMaxPlaintextLength();
      
      // Should allow at least 1000 chars
      expect(maxLength).toBeGreaterThan(1000);
      
      // Should be less than 2000 (message limit minus overhead)
      expect(maxLength).toBeLessThan(2000);
    });

    it('wrapped message stays under 2000 chars at max length', () => {
      const maxLength = getMaxPlaintextLength();
      
      // Simulate a max-length ciphertext (base64 is ~33% larger than input)
      const largeCiphertext = btoa('X'.repeat(maxLength));
      const payload: EncryptedPayload = {
        ciphertext: largeCiphertext,
        iv: 'dGVzdCBpdg==',
        version: 1,
      };

      const wrapped = wrapE2EMessage(payload);
      
      // Should fit within Fluxer's 2000 char limit
      expect(wrapped.length).toBeLessThanOrEqual(2000);
    });
  });
});
