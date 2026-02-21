/*
 * Channel key management for E2E encryption.
 * 
 * Handles key generation, storage, and retrieval for channels and DMs.
 */

import {
  generateSymmetricKey,
  exportKey,
  importSymmetricKey,
  type CryptoKey,
} from '../crypto/Crypto';
import { KeyStore, type StoredKey } from './KeyStore';

export interface ChannelKeyInfo {
  /** The CryptoKey ready for use */
  key: CryptoKey;
  /** Key ID for reference */
  keyId: string;
  /** When this key was created */
  createdAt: number;
}

/**
 * Manages encryption keys for channels and DMs.
 */
export class ChannelKeyManager {
  private keyStore: KeyStore;
  private keyCache = new Map<string, CryptoKey>();

  constructor(keyStore?: KeyStore) {
    this.keyStore = keyStore ?? new KeyStore();
  }

  /**
   * Get or create a key for a channel.
   * If no key exists, generates a new one.
   */
  async getOrCreateChannelKey(channelId: string): Promise<ChannelKeyInfo> {
    // Check cache first
    const cached = this.keyCache.get(channelId);
    if (cached) {
      const stored = await this.keyStore.getKeyForTarget(channelId, 'channel');
      if (stored) {
        return {
          key: cached,
          keyId: stored.id,
          createdAt: stored.createdAt,
        };
      }
    }

    // Check store
    const stored = await this.keyStore.getKeyForTarget(channelId, 'channel');
    if (stored) {
      const key = await importSymmetricKey(stored.keyMaterial);
      this.keyCache.set(channelId, key);
      return {
        key,
        keyId: stored.id,
        createdAt: stored.createdAt,
      };
    }

    // Generate new key
    return await this.createChannelKey(channelId);
  }

  /**
   * Create a new key for a channel (overwriting any existing).
   */
  async createChannelKey(channelId: string, label?: string): Promise<ChannelKeyInfo> {
    const key = await generateSymmetricKey();
    const keyMaterial = await exportKey(key);
    const keyId = `channel:${channelId}:${Date.now()}`;
    const now = Date.now();

    const storedKey: StoredKey = {
      id: keyId,
      type: 'channel',
      keyMaterial,
      targetId: channelId,
      createdAt: now,
      expiresAt: 0,  // Channel keys don't expire by default
      label: label ?? `Key for channel ${channelId}`,
    };

    await this.keyStore.storeKey(storedKey);
    this.keyCache.set(channelId, key);

    return {
      key,
      keyId,
      createdAt: now,
    };
  }

  /**
   * Get or create a key for a DM conversation.
   */
  async getOrCreateDMKey(dmChannelId: string): Promise<ChannelKeyInfo> {
    // Check cache
    const cached = this.keyCache.get(dmChannelId);
    if (cached) {
      const stored = await this.keyStore.getKeyForTarget(dmChannelId, 'dm');
      if (stored) {
        return {
          key: cached,
          keyId: stored.id,
          createdAt: stored.createdAt,
        };
      }
    }

    // Check store
    const stored = await this.keyStore.getKeyForTarget(dmChannelId, 'dm');
    if (stored) {
      const key = await importSymmetricKey(stored.keyMaterial);
      this.keyCache.set(dmChannelId, key);
      return {
        key,
        keyId: stored.id,
        createdAt: stored.createdAt,
      };
    }

    // Generate new key
    return await this.createDMKey(dmChannelId);
  }

  /**
   * Create a new key for a DM.
   */
  async createDMKey(dmChannelId: string, label?: string): Promise<ChannelKeyInfo> {
    const key = await generateSymmetricKey();
    const keyMaterial = await exportKey(key);
    const keyId = `dm:${dmChannelId}:${Date.now()}`;
    const now = Date.now();

    const storedKey: StoredKey = {
      id: keyId,
      type: 'dm',
      keyMaterial,
      targetId: dmChannelId,
      createdAt: now,
      expiresAt: 0,
      label: label ?? `DM key`,
    };

    await this.keyStore.storeKey(storedKey);
    this.keyCache.set(dmChannelId, key);

    return {
      key,
      keyId,
      createdAt: now,
    };
  }

  /**
   * Import a shared key (received from another user).
   */
  async importSharedKey(
    channelId: string,
    keyMaterial: string,
    type: 'channel' | 'dm',
    keyId?: string
  ): Promise<ChannelKeyInfo> {
    const key = await importSymmetricKey(keyMaterial);
    const id = keyId ?? `${type}:${channelId}:${Date.now()}`;
    const now = Date.now();

    const storedKey: StoredKey = {
      id,
      type,
      keyMaterial,
      targetId: channelId,
      createdAt: now,
      expiresAt: 0,
      label: `Imported key`,
    };

    await this.keyStore.storeKey(storedKey);
    this.keyCache.set(channelId, key);

    return {
      key,
      keyId: id,
      createdAt: now,
    };
  }

  /**
   * Export a key for sharing with another user.
   */
  async exportKeyForSharing(channelId: string): Promise<string | null> {
    const stored = await this.keyStore.getKeyForTarget(channelId, 'channel')
      ?? await this.keyStore.getKeyForTarget(channelId, 'dm');
    
    return stored?.keyMaterial ?? null;
  }

  /**
   * Check if we have a key for a channel.
   */
  async hasKey(channelId: string): Promise<boolean> {
    if (this.keyCache.has(channelId)) {
      return true;
    }
    const stored = await this.keyStore.getKeyForTarget(channelId, 'channel')
      ?? await this.keyStore.getKeyForTarget(channelId, 'dm');
    return stored !== null;
  }

  /**
   * Delete a key (for key rotation or leaving channel).
   */
  async deleteKey(channelId: string): Promise<void> {
    const stored = await this.keyStore.getKeyForTarget(channelId, 'channel')
      ?? await this.keyStore.getKeyForTarget(channelId, 'dm');
    
    if (stored) {
      await this.keyStore.deleteKey(stored.id);
    }
    this.keyCache.delete(channelId);
  }

  /**
   * Clear all keys (for logout).
   */
  async clearAll(): Promise<void> {
    await this.keyStore.clear();
    this.keyCache.clear();
  }

  /**
   * Get all secure channels we have keys for.
   */
  async getSecureChannels(): Promise<string[]> {
    const channelKeys = await this.keyStore.getKeysByType('channel');
    const dmKeys = await this.keyStore.getKeysByType('dm');
    return [...channelKeys, ...dmKeys].map(k => k.targetId);
  }
}
