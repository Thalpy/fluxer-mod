/*
 * E2E Manager - Main entry point for E2E encryption.
 * 
 * This is the primary interface used by the Fluxer app.
 * Provides simple encrypt/decrypt methods that handle all the complexity.
 */

import { encrypt, decrypt } from './crypto/Crypto';
import {
  isE2EMessage,
  wrapE2EMessage,
  unwrapE2EMessage,
  getMaxPlaintextLength,
  type E2EMessageEnvelope,
} from './crypto/MessageFormat';
import { ChannelKeyManager, type ChannelKeyInfo } from './store/ChannelKeyManager';
import { KeyStore } from './store/KeyStore';

export interface E2EConfig {
  /** Automatically enable E2E for all DMs */
  autoEncryptDMs: boolean;
  /** Channel IDs that should use E2E */
  secureChannels: Set<string>;
}

export interface ProcessedMessage {
  /** The displayable content (decrypted if was encrypted) */
  content: string;
  /** Whether this message was encrypted */
  isEncrypted: boolean;
  /** If encrypted, the key ID used */
  keyId?: string;
  /** If decryption failed, the error */
  error?: string;
}

/**
 * Main E2E encryption manager.
 * 
 * Usage:
 *   import { e2eManager } from '@fluxer/e2e';
 *   
 *   // Check if channel uses E2E
 *   if (e2eManager.isSecureChannel(channelId)) {
 *     content = await e2eManager.encryptMessage(channelId, content);
 *   }
 *   
 *   // Process incoming message
 *   const processed = await e2eManager.processMessage(channelId, message.content);
 *   displayContent = processed.content;
 */
export class E2EManager {
  private keyManager: ChannelKeyManager;
  private config: E2EConfig;
  private initialized = false;

  constructor(keyStore?: KeyStore) {
    this.keyManager = new ChannelKeyManager(keyStore);
    this.config = {
      autoEncryptDMs: false,
      secureChannels: new Set(),
    };
  }

  /**
   * Initialize E2E (load config, etc.)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Load secure channels list from localStorage if available
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('fluxer-e2e-config');
        if (stored) {
          const parsed = JSON.parse(stored);
          this.config.autoEncryptDMs = parsed.autoEncryptDMs ?? false;
          this.config.secureChannels = new Set(parsed.secureChannels ?? []);
        }
      } catch {
        // Ignore parse errors
      }
    }

    this.initialized = true;
  }

  /**
   * Save config to localStorage.
   */
  private saveConfig(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('fluxer-e2e-config', JSON.stringify({
        autoEncryptDMs: this.config.autoEncryptDMs,
        secureChannels: Array.from(this.config.secureChannels),
      }));
    }
  }

  // ============================================
  // Configuration
  // ============================================

  /**
   * Mark a channel as secure (E2E enabled).
   */
  async enableE2E(channelId: string): Promise<ChannelKeyInfo> {
    this.config.secureChannels.add(channelId);
    this.saveConfig();
    return await this.keyManager.getOrCreateChannelKey(channelId);
  }

  /**
   * Disable E2E for a channel.
   */
  async disableE2E(channelId: string): Promise<void> {
    this.config.secureChannels.delete(channelId);
    this.saveConfig();
    // Note: We don't delete the key - old messages still need it
  }

  /**
   * Check if a channel has E2E enabled.
   */
  isSecureChannel(channelId: string): boolean {
    return this.config.secureChannels.has(channelId);
  }

  /**
   * Check if a DM channel should use E2E.
   */
  isSecureDM(dmChannelId: string): boolean {
    return this.config.autoEncryptDMs || this.config.secureChannels.has(dmChannelId);
  }

  /**
   * Set whether DMs are automatically encrypted.
   */
  setAutoEncryptDMs(enabled: boolean): void {
    this.config.autoEncryptDMs = enabled;
    this.saveConfig();
  }

  /**
   * Get all channels with E2E enabled.
   */
  getSecureChannels(): string[] {
    return Array.from(this.config.secureChannels);
  }

  // ============================================
  // Encryption / Decryption
  // ============================================

  /**
   * Encrypt a message for a channel.
   * Returns the wrapped message ready to send.
   */
  async encryptMessage(channelId: string, plaintext: string): Promise<string> {
    // Quick pre-check to reject obviously too-long messages
    const maxLength = getMaxPlaintextLength();
    if (plaintext.length > maxLength) {
      throw new Error(`Message too long for E2E encryption. Max ${maxLength} characters.`);
    }

    const keyInfo = await this.keyManager.getOrCreateChannelKey(channelId);
    const payload = await encrypt(plaintext, keyInfo.key);
    const wrapped = wrapE2EMessage(payload, keyInfo.keyId);

    // Final check: verify actual wrapped length doesn't exceed Fluxer's limit
    if (wrapped.length > 2000) {
      throw new Error(
        `Encrypted message too long (${wrapped.length} chars). ` +
        `Please shorten your message by approximately ${Math.ceil((wrapped.length - 2000) * 0.5)} characters.`
      );
    }

    return wrapped;
  }

  /**
   * Encrypt a DM message.
   */
  async encryptDM(dmChannelId: string, plaintext: string): Promise<string> {
    // Quick pre-check to reject obviously too-long messages
    const maxLength = getMaxPlaintextLength();
    if (plaintext.length > maxLength) {
      throw new Error(`Message too long for E2E encryption. Max ${maxLength} characters.`);
    }

    const keyInfo = await this.keyManager.getOrCreateDMKey(dmChannelId);
    const payload = await encrypt(plaintext, keyInfo.key);
    const wrapped = wrapE2EMessage(payload, keyInfo.keyId);

    // Final check: verify actual wrapped length doesn't exceed Fluxer's limit
    if (wrapped.length > 2000) {
      throw new Error(
        `Encrypted message too long (${wrapped.length} chars). ` +
        `Please shorten your message by approximately ${Math.ceil((wrapped.length - 2000) * 0.5)} characters.`
      );
    }

    return wrapped;
  }

  /**
   * Process an incoming message.
   * Automatically detects E2E messages and decrypts them.
   * Works for both channel messages and DMs.
   * 
   * Uses the key ID from the envelope (envelope.k) when available to ensure
   * the correct key is used, especially after key rotation or import.
   * Never creates new keys - only uses existing keys for decryption.
   */
  async processMessage(channelId: string, content: string, isDM = false): Promise<ProcessedMessage> {
    // Not an E2E message - return as-is
    if (!isE2EMessage(content)) {
      return {
        content,
        isEncrypted: false,
      };
    }

    // Unwrap the envelope
    const envelope = unwrapE2EMessage(content);
    if (!envelope) {
      return {
        content: '🔒 [Invalid encrypted message]',
        isEncrypted: true,
        error: 'Failed to parse encrypted message',
      };
    }

    // Try to get the specific key by ID first (most reliable for rotated/imported keys)
    if (envelope.k) {
      try {
        const keyInfo = await this.keyManager.getKeyById(envelope.k);
        if (keyInfo) {
          const plaintext = await decrypt(envelope.p, keyInfo.key);
          return {
            content: plaintext,
            isEncrypted: true,
            keyId: envelope.k,
          };
        }
      } catch {
        // Key ID didn't work, fall through to target-based lookup
      }
    }

    // Fall back to looking up by channel/DM target (for backward compat or missing key IDs)
    // Use getExisting* methods to avoid creating new keys during decryption
    const keyInfo = isDM
      ? await this.keyManager.getExistingDMKey(channelId)
      : await this.keyManager.getExistingChannelKey(channelId);

    if (!keyInfo) {
      // Try the other type as fallback
      const fallbackKeyInfo = isDM
        ? await this.keyManager.getExistingChannelKey(channelId)
        : await this.keyManager.getExistingDMKey(channelId);

      if (!fallbackKeyInfo) {
        return {
          content: '🔒 [Encrypted - no key available]',
          isEncrypted: true,
          keyId: envelope.k,
          error: 'No decryption key for this channel',
        };
      }

      // Try with fallback key
      try {
        const plaintext = await decrypt(envelope.p, fallbackKeyInfo.key);
        return {
          content: plaintext,
          isEncrypted: true,
          keyId: envelope.k,
        };
      } catch (err) {
        return {
          content: '🔒 [Decryption failed]',
          isEncrypted: true,
          keyId: envelope.k,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    }

    // Decrypt with primary key
    try {
      const plaintext = await decrypt(envelope.p, keyInfo.key);
      return {
        content: plaintext,
        isEncrypted: true,
        keyId: envelope.k,
      };
    } catch (err) {
      // Primary key failed, try the other type as fallback
      const fallbackKeyInfo = isDM
        ? await this.keyManager.getExistingChannelKey(channelId)
        : await this.keyManager.getExistingDMKey(channelId);

      if (fallbackKeyInfo) {
        try {
          const plaintext = await decrypt(envelope.p, fallbackKeyInfo.key);
          return {
            content: plaintext,
            isEncrypted: true,
            keyId: envelope.k,
          };
        } catch {
          // Fall through to error
        }
      }

      return {
        content: '🔒 [Decryption failed]',
        isEncrypted: true,
        keyId: envelope.k,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  // ============================================
  // Key sharing
  // ============================================

  /**
   * Export a channel key for sharing.
   * Returns a shareable string the recipient can import.
   */
  async exportKey(channelId: string): Promise<string | null> {
    const keyMaterial = await this.keyManager.exportKeyForSharing(channelId);
    if (!keyMaterial) return null;

    // Encode for sharing (could add checksum, metadata, etc.)
    const shareData = {
      v: 1,
      c: channelId,
      k: keyMaterial,
    };

    return btoa(JSON.stringify(shareData));
  }

  /**
   * Import a shared key.
   */
  async importKey(shareString: string): Promise<{ channelId: string; success: boolean }> {
    try {
      const shareData = JSON.parse(atob(shareString));
      
      if (shareData.v !== 1 || !shareData.c || !shareData.k) {
        return { channelId: '', success: false };
      }

      await this.keyManager.importSharedKey(
        shareData.c,
        shareData.k,
        'channel'
      );

      this.config.secureChannels.add(shareData.c);
      this.saveConfig();

      return { channelId: shareData.c, success: true };
    } catch {
      return { channelId: '', success: false };
    }
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Check if a message content is encrypted.
   */
  isEncryptedMessage(content: string): boolean {
    return isE2EMessage(content);
  }

  /**
   * Clear all E2E data (for logout).
   */
  async clear(): Promise<void> {
    await this.keyManager.clearAll();
    this.config.secureChannels.clear();
    this.config.autoEncryptDMs = false;
    this.saveConfig();
  }

  /**
   * Get max plaintext length for encrypted messages.
   */
  getMaxMessageLength(): number {
    return getMaxPlaintextLength();
  }
}

// Global singleton for easy import
export const e2eManager = new E2EManager();
