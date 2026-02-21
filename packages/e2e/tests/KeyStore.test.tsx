/*
 * Tests for KeyStore - key storage and retrieval.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KeyStore, type StoredKey } from '../src/store/KeyStore';

describe('KeyStore', () => {
  let keyStore: KeyStore;

  beforeEach(() => {
    keyStore = KeyStore.createMemoryStore();
  });

  describe('Basic Operations', () => {
    it('stores and retrieves a key by ID', async () => {
      const key: StoredKey = {
        id: 'test-key-1',
        type: 'channel',
        keyMaterial: 'base64-key-material',
        targetId: 'channel-123',
        createdAt: Date.now(),
        expiresAt: 0,
      };

      await keyStore.storeKey(key);
      const retrieved = await keyStore.getKey(key.id);

      expect(retrieved).toEqual(key);
    });

    it('returns null for non-existent key', async () => {
      const retrieved = await keyStore.getKey('non-existent');
      expect(retrieved).toBeNull();
    });

    it('deletes a key', async () => {
      const key: StoredKey = {
        id: 'delete-test',
        type: 'channel',
        keyMaterial: 'material',
        targetId: 'channel-456',
        createdAt: Date.now(),
        expiresAt: 0,
      };

      await keyStore.storeKey(key);
      await keyStore.deleteKey(key.id);
      
      const retrieved = await keyStore.getKey(key.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('getKeyForTarget - Multiple Keys', () => {
    it('returns the newest key when multiple exist for same target', async () => {
      const channelId = 'multi-key-channel';
      const now = Date.now();

      // Store old key
      const oldKey: StoredKey = {
        id: 'key-old',
        type: 'channel',
        keyMaterial: 'old-material',
        targetId: channelId,
        createdAt: now - 10000,  // 10 seconds ago
        expiresAt: 0,
      };

      // Store new key
      const newKey: StoredKey = {
        id: 'key-new',
        type: 'channel',
        keyMaterial: 'new-material',
        targetId: channelId,
        createdAt: now,  // Now
        expiresAt: 0,
      };

      // Store in reverse order to ensure it's not just returning last inserted
      await keyStore.storeKey(newKey);
      await keyStore.storeKey(oldKey);

      const retrieved = await keyStore.getKeyForTarget(channelId, 'channel');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('key-new');
      expect(retrieved!.keyMaterial).toBe('new-material');
    });

    it('handles three or more keys correctly', async () => {
      const channelId = 'many-keys-channel';
      const now = Date.now();

      const keys: StoredKey[] = [
        { id: 'key-1', type: 'channel', keyMaterial: 'm1', targetId: channelId, createdAt: now - 30000, expiresAt: 0 },
        { id: 'key-2', type: 'channel', keyMaterial: 'm2', targetId: channelId, createdAt: now - 20000, expiresAt: 0 },
        { id: 'key-3', type: 'channel', keyMaterial: 'm3', targetId: channelId, createdAt: now - 10000, expiresAt: 0 },
        { id: 'key-newest', type: 'channel', keyMaterial: 'newest', targetId: channelId, createdAt: now, expiresAt: 0 },
      ];

      // Store in random order
      await keyStore.storeKey(keys[2]);
      await keyStore.storeKey(keys[0]);
      await keyStore.storeKey(keys[3]);
      await keyStore.storeKey(keys[1]);

      const retrieved = await keyStore.getKeyForTarget(channelId, 'channel');

      expect(retrieved!.id).toBe('key-newest');
    });

    it('distinguishes between channel and DM keys for same targetId', async () => {
      const targetId = 'shared-target';
      const now = Date.now();

      const channelKey: StoredKey = {
        id: 'channel-key',
        type: 'channel',
        keyMaterial: 'channel-material',
        targetId,
        createdAt: now,
        expiresAt: 0,
      };

      const dmKey: StoredKey = {
        id: 'dm-key',
        type: 'dm',
        keyMaterial: 'dm-material',
        targetId,
        createdAt: now,
        expiresAt: 0,
      };

      await keyStore.storeKey(channelKey);
      await keyStore.storeKey(dmKey);

      const retrievedChannel = await keyStore.getKeyForTarget(targetId, 'channel');
      const retrievedDM = await keyStore.getKeyForTarget(targetId, 'dm');

      expect(retrievedChannel!.id).toBe('channel-key');
      expect(retrievedDM!.id).toBe('dm-key');
    });
  });

  describe('Expired Keys', () => {
    it('filters out expired keys on get', async () => {
      const key: StoredKey = {
        id: 'expired-key',
        type: 'channel',
        keyMaterial: 'material',
        targetId: 'channel-exp',
        createdAt: Date.now() - 10000,
        expiresAt: Date.now() - 5000,  // Expired 5 seconds ago
      };

      await keyStore.storeKey(key);
      const retrieved = await keyStore.getKey(key.id);

      expect(retrieved).toBeNull();
    });

    it('returns non-expired keys', async () => {
      const key: StoredKey = {
        id: 'valid-key',
        type: 'channel',
        keyMaterial: 'material',
        targetId: 'channel-valid',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60000,  // Expires in 1 minute
      };

      await keyStore.storeKey(key);
      const retrieved = await keyStore.getKey(key.id);

      expect(retrieved).not.toBeNull();
    });

    it('treats expiresAt=0 as never expires', async () => {
      const key: StoredKey = {
        id: 'never-expires',
        type: 'channel',
        keyMaterial: 'material',
        targetId: 'channel-forever',
        createdAt: Date.now() - 86400000,  // Created 1 day ago
        expiresAt: 0,  // Never expires
      };

      await keyStore.storeKey(key);
      const retrieved = await keyStore.getKey(key.id);

      expect(retrieved).not.toBeNull();
    });
  });

  describe('Clear', () => {
    it('clears all keys', async () => {
      await keyStore.storeKey({
        id: 'key-1', type: 'channel', keyMaterial: 'm', targetId: 't1', createdAt: Date.now(), expiresAt: 0
      });
      await keyStore.storeKey({
        id: 'key-2', type: 'dm', keyMaterial: 'm', targetId: 't2', createdAt: Date.now(), expiresAt: 0
      });

      await keyStore.clear();

      expect(await keyStore.getKey('key-1')).toBeNull();
      expect(await keyStore.getKey('key-2')).toBeNull();
    });
  });
});
