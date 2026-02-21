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

/**
 * Wrap an encrypted payload into a message string.
 * Format: [prefix][fallback]\n[json payload]
 * 
 * Non-E2E clients will show the fallback text.
 * E2E clients will parse and decrypt the JSON.
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
  
  // Format: prefix + fallback + newline + base64(json)
  // The fallback ensures non-E2E clients see something readable
  return `${E2E_MESSAGE_PREFIX}${FALLBACK_MESSAGE}\n${btoa(json)}`;
}

/**
 * Extract the encrypted payload from an E2E message.
 * Returns null if not a valid E2E message.
 */
export function unwrapE2EMessage(content: string): E2EMessageEnvelope | null {
  if (!isE2EMessage(content)) {
    return null;
  }

  try {
    // Find the base64 payload after the newline
    const newlineIndex = content.indexOf('\n');
    if (newlineIndex === -1) {
      return null;
    }

    const base64Payload = content.slice(newlineIndex + 1).trim();
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
  // Rough estimate: prefix + fallback + newline + base64 overhead (~33%)
  const overhead = E2E_MESSAGE_PREFIX.length + FALLBACK_MESSAGE.length + 1 + 100;
  const available = 2000 - overhead;
  // Base64 expands by ~33%, so max plaintext is about 75% of available
  return Math.floor(available * 0.75);
}
