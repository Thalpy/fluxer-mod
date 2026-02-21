/*
 * Message format for E2E encrypted messages.
 * 
 * Encrypted messages are stored as JSON with a recognizable prefix,
 * allowing non-E2E clients to show a fallback message.
 */

import type { EncryptedPayload } from './Crypto';

// Prefix that identifies E2E messages (invisible Unicode + marker)
export const E2E_MESSAGE_PREFIX = '\u200B\u200B[E2E]';

// Fallback message shown to clients without E2E support
const FALLBACK_MESSAGE = '🔒 This message is encrypted. Use an E2E-enabled client to view.';

export interface E2EMessageEnvelope {
  /** Version for future format changes */
  v: 1;
  /** Encrypted payload */
  p: EncryptedPayload;
  /** Key ID used (for multi-key scenarios) */
  k?: string;
}

/**
 * Check if a message content string is an E2E encrypted message.
 */
export function isE2EMessage(content: string): boolean {
  return content.startsWith(E2E_MESSAGE_PREFIX);
}

// Delimiter that separates the visible fallback from the hidden payload
// Uses zero-width characters that won't render but can be detected
const PAYLOAD_DELIMITER = '\u200B\u200C\u200B';

/**
 * Wrap an encrypted payload into a message string.
 * 
 * Format: [prefix][fallback][delimiter][payload in spoiler]
 * 
 * The payload is wrapped in spoiler tags (||...||) so non-E2E clients
 * see only the fallback text, with the encrypted data hidden behind
 * a spoiler. E2E clients detect the delimiter and extract the payload.
 * 
 * For clients that don't support spoilers, the payload appears as a
 * collapsed/hidden block that users won't accidentally read.
 */
export function wrapE2EMessage(
  payload: EncryptedPayload,
  keyId?: string
): string {
  const envelope: E2EMessageEnvelope = {
    v: 1,
    p: payload,
    ...(keyId && { k: keyId }),
  };

  // Compact JSON to save space (messages have 2000 char limit)
  const json = JSON.stringify(envelope);
  const b64 = btoa(json);
  
  // Format: prefix + fallback + delimiter + spoiler-wrapped payload
  // The spoiler tags hide the payload in most clients
  // The delimiter allows E2E clients to find the payload boundary
  return `${E2E_MESSAGE_PREFIX}${FALLBACK_MESSAGE}${PAYLOAD_DELIMITER}||${b64}||`;
}

/**
 * Extract the encrypted payload from an E2E message.
 * Returns null if not a valid E2E message.
 * 
 * Supports both old format (newline separator) and new format (delimiter + spoiler).
 */
export function unwrapE2EMessage(content: string): E2EMessageEnvelope | null {
  if (!isE2EMessage(content)) {
    return null;
  }

  try {
    let base64Payload: string;

    // Try new format first: delimiter + spoiler tags
    const delimiterIndex = content.indexOf(PAYLOAD_DELIMITER);
    if (delimiterIndex !== -1) {
      // Extract payload from between spoiler tags ||...||
      const afterDelimiter = content.slice(delimiterIndex + PAYLOAD_DELIMITER.length);
      const match = afterDelimiter.match(/^\|\|([A-Za-z0-9+/=]+)\|\|$/);
      if (match) {
        base64Payload = match[1];
      } else {
        // Fallback: just take everything after delimiter, strip spoiler tags if present
        base64Payload = afterDelimiter.replace(/^\|\|/, '').replace(/\|\|$/, '').trim();
      }
    } else {
      // Old format: newline separator
      const newlineIndex = content.indexOf('\n');
      if (newlineIndex === -1) {
        return null;
      }
      base64Payload = content.slice(newlineIndex + 1).trim();
    }

    const json = atob(base64Payload);
    const envelope = JSON.parse(json) as E2EMessageEnvelope;

    // Validate structure
    if (envelope.v !== 1 || !envelope.p?.ciphertext || !envelope.p?.iv) {
      return null;
    }

    return envelope;
  } catch {
    return null;
  }
}

/**
 * Get the fallback text that non-E2E clients will see.
 */
export function getE2EFallbackText(): string {
  return `${E2E_MESSAGE_PREFIX}${FALLBACK_MESSAGE}`;
}

/**
 * Calculate remaining space for encrypted content.
 * Fluxer has a 2000 char limit; we need to account for wrapper overhead.
 */
export function getMaxPlaintextLength(): number {
  // Overhead: prefix + fallback + delimiter + spoiler tags (||...||) + base64 expansion
  const fixedOverhead = E2E_MESSAGE_PREFIX.length + FALLBACK_MESSAGE.length + 
                        PAYLOAD_DELIMITER.length + 4; // 4 for ||...||
  // JSON envelope adds ~50 chars, and base64 expands by 4/3
  const jsonOverhead = 50;
  const available = 2000 - fixedOverhead - jsonOverhead;
  // Base64 expands by ~33%, and AES-GCM adds 16-byte auth tag + 12-byte IV
  // So max plaintext ≈ available * 0.75 - 28 bytes overhead
  return Math.floor(available * 0.65); // Conservative estimate
}
