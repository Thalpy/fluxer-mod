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
  // Cache keyed by `${type}:${targetId}` to prevent collisions between
  // channel and DM keys with the same target ID
  private keyCache = new Map<string, CryptoKey>();

  constructor(keyStore?: KeyStore) {
    this.keyStore = keyStore ?? new KeyStore();
  }

  /** Generate cache key to prevent type collisions */
  private cacheKey(type: 'channel' | 'dm', targetId: string): string {
    return `${type}:${targetId}`;
  }

  /**
   * Get or create a key for a channel.
   * If no key exists, generates a new one.
   */
  async getOrCreateChannelKey(channelId: string): Promise<ChannelKeyInfo> {
    const cacheK = this.cacheKey('channel', channelId);
    
    // Check cache first
    const cached = this.keyCache.get(cacheK);
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
      this.keyCache.set(cacheK, key);
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
   * Get an existing channel key without creating a new one.
   * Returns null if no key exists.
   */
  async getExistingChannelKey(channelId: string): Promise<ChannelKeyInfo | null> {
    const cacheK = this.cacheKey('channel', channelId);
    
    // Check cache first
    const cached = this.keyCache.get(cacheK);
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
      this.keyCache.set(cacheK, key);
      return {
        key,
        keyId: stored.id,
        createdAt: stored.createdAt,
      };
    }

    return null;
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
    this.keyCache.set(this.cacheKey('channel', channelId), key);

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
    const cacheK = this.cacheKey('dm', dmChannelId);
    
    // Check cache
    const cached = this.keyCache.get(cacheK);
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
      this.keyCache.set(cacheK, key);
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
   * Get an existing DM key without creating a new one.
   * Returns null if no key exists.
   */
  async getExistingDMKey(dmChannelId: string): Promise<ChannelKeyInfo | null> {
    const cacheK = this.cacheKey('dm', dmChannelId);
    
    // Check cache
    const cached = this.keyCache.get(cacheK);
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
      this.keyCache.set(cacheK, key);
      return {
        key,
        keyId: stored.id,
        createdAt: stored.createdAt,
      };
    }

    return null;
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
    this.keyCache.set(this.cacheKey('dm', dmChannelId), key);

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
    this.keyCache.set(this.cacheKey(type, channelId), key);

    return {
      key,
      keyId: id,
      createdAt: now,
    };
  }

  /**
   * Get a key by its ID (from envelope.k).
   * Returns null if key not found.
   */
  async getKeyById(keyId: string): Promise<ChannelKeyInfo | null> {
    const stored = await this.keyStore.getKey(keyId);
    if (!stored) {
      return null;
    }

    const cacheK = this.cacheKey(stored.type, stored.targetId);
    
    // Check cache first
    const cached = this.keyCache.get(cacheK);
    if (cached) {
      return {
        key: cached,
        keyId: stored.id,
        createdAt: stored.createdAt,
      };
    }

    // Import and cache
    const key = await importSymmetricKey(stored.keyMaterial);
    this.keyCache.set(cacheK, key);
    
    return {
      key,
      keyId: stored.id,
      createdAt: stored.createdAt,
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
   * Check if we have a key for a channel (checks both channel and DM types).
   */
  async hasKey(channelId: string): Promise<boolean> {
    // Check cache for either type
    if (this.keyCache.has(this.cacheKey('channel', channelId)) ||
        this.keyCache.has(this.cacheKey('dm', channelId))) {
      return true;
    }
    // Check store
    const stored = await this.keyStore.getKeyForTarget(channelId, 'channel')
      ?? await this.keyStore.getKeyForTarget(channelId, 'dm');
    return stored !== null;
  }

  /**
   * Check if we have a specific type of key.
   */
  async hasKeyOfType(channelId: string, type: 'channel' | 'dm'): Promise<boolean> {
    if (this.keyCache.has(this.cacheKey(type, channelId))) {
      return true;
    }
    const stored = await this.keyStore.getKeyForTarget(channelId, type);
    return stored !== null;
  }

  /**
   * Delete a key (for key rotation or leaving channel).
   */
  async deleteKey(channelId: string, type?: 'channel' | 'dm'): Promise<void> {
    if (type) {
      // Delete specific type
      const stored = await this.keyStore.getKeyForTarget(channelId, type);
      if (stored) {
        await this.keyStore.deleteKey(stored.id);
      }
      this.keyCache.delete(this.cacheKey(type, channelId));
    } else {
      // Delete both types
      const channelStored = await this.keyStore.getKeyForTarget(channelId, 'channel');
      const dmStored = await this.keyStore.getKeyForTarget(channelId, 'dm');
      
      if (channelStored) await this.keyStore.deleteKey(channelStored.id);
      if (dmStored) await this.keyStore.deleteKey(dmStored.id);
      
      this.keyCache.delete(this.cacheKey('channel', channelId));
      this.keyCache.delete(this.cacheKey('dm', channelId));
    }
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
