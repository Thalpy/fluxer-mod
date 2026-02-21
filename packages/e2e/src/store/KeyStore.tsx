/*
 * Local key storage for E2E encryption keys.
 * 
 * Uses IndexedDB in browser, with fallback to in-memory for testing.
 * 
 * SECURITY NOTE: Keys are currently stored as base64 in IndexedDB.
 * This relies on browser/OS-level storage isolation for protection.
 * 
 * For stronger at-rest protection, a future version could:
 * - Encrypt keys with a device-specific key
 * - Use Web Crypto's non-extractable keys where possible
 * - Integrate with platform secure storage (e.g., Electron's safeStorage)
 * 
 * Current threat model assumes:
 * - Attacker does not have local filesystem/IndexedDB access
 * - Browser same-origin policy is intact
 */

export interface StoredKey {
  /** Unique key ID */
  id: string;
  /** Key type: 'channel' | 'dm' | 'identity' */
  type: 'channel' | 'dm' | 'identity';
  /** The actual key material (base64) */
  keyMaterial: string;
  /** Channel/DM ID this key is for */
  targetId: string;
  /** When this key was created */
  createdAt: number;
  /** When this key expires (0 = never) */
  expiresAt: number;
  /** Human-readable label */
  label?: string;
}

interface KeyStoreBackend {
  get(id: string): Promise<StoredKey | null>;
  set(key: StoredKey): Promise<void>;
  delete(id: string): Promise<void>;
  getByTarget(targetId: string, type: StoredKey['type']): Promise<StoredKey | null>;
  getAllByType(type: StoredKey['type']): Promise<StoredKey[]>;
  clear(): Promise<void>;
}

/**
 * In-memory backend for testing and SSR.
 */
class MemoryKeyStoreBackend implements KeyStoreBackend {
  private keys = new Map<string, StoredKey>();

  async get(id: string): Promise<StoredKey | null> {
    return this.keys.get(id) ?? null;
  }

  async set(key: StoredKey): Promise<void> {
    this.keys.set(key.id, key);
  }

  async delete(id: string): Promise<void> {
    this.keys.delete(id);
  }

  async getByTarget(targetId: string, type: StoredKey['type']): Promise<StoredKey | null> {
    // Find all matching keys and return the newest (highest createdAt)
    let newest: StoredKey | null = null;
    for (const key of this.keys.values()) {
      if (key.targetId === targetId && key.type === type) {
        if (!newest || key.createdAt > newest.createdAt) {
          newest = key;
        }
      }
    }
    return newest;
  }

  async getAllByType(type: StoredKey['type']): Promise<StoredKey[]> {
    return Array.from(this.keys.values()).filter(k => k.type === type);
  }

  async clear(): Promise<void> {
    this.keys.clear();
  }
}

/**
 * IndexedDB backend for browser persistence.
 */
class IndexedDBKeyStoreBackend implements KeyStoreBackend {
  private dbName = 'fluxer-e2e-keys';
  private storeName = 'keys';
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('targetId', 'targetId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('targetType', ['targetId', 'type'], { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  async get(id: string): Promise<StoredKey | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(id);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result ?? null);
    });
  }

  async set(key: StoredKey): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(id);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getByTarget(targetId: string, type: StoredKey['type']): Promise<StoredKey | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const index = store.index('targetType');
      // Use getAll() to handle multiple keys per target (e.g., after key rotation)
      // and return the most recent one
      const request = index.getAll([targetId, type]);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const keys = request.result as StoredKey[];
        if (keys.length === 0) {
          resolve(null);
        } else if (keys.length === 1) {
          resolve(keys[0]);
        } else {
          // Return the newest key (highest createdAt)
          const newest = keys.reduce((a, b) => a.createdAt > b.createdAt ? a : b);
          resolve(newest);
        }
      };
    });
  }

  async getAllByType(type: StoredKey['type']): Promise<StoredKey[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const index = store.index('type');
      const request = index.getAll(type);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

/**
 * Key store with automatic backend selection.
 */
export class KeyStore {
  private backend: KeyStoreBackend;

  constructor(backend?: KeyStoreBackend) {
    if (backend) {
      this.backend = backend;
    } else if (typeof indexedDB !== 'undefined') {
      this.backend = new IndexedDBKeyStoreBackend();
    } else {
      this.backend = new MemoryKeyStoreBackend();
    }
  }

  /**
   * Store a key.
   */
  async storeKey(key: StoredKey): Promise<void> {
    await this.backend.set(key);
  }

  /**
   * Get a key by ID.
   */
  async getKey(id: string): Promise<StoredKey | null> {
    const key = await this.backend.get(id);
    if (key && key.expiresAt > 0 && Date.now() > key.expiresAt) {
      await this.backend.delete(id);
      return null;
    }
    return key;
  }

  /**
   * Get the key for a specific channel or DM.
   */
  async getKeyForTarget(
    targetId: string,
    type: StoredKey['type']
  ): Promise<StoredKey | null> {
    // Keep fetching the newest key for this target until we find a valid one
    // or there are no keys left. This handles key rotation where older keys
    // may still be valid even if the newest one has expired.
    // 
    // We rely on the backend to return the next "newest" key after deletion.
    while (true) {
      const key = await this.backend.getByTarget(targetId, type);
      if (!key) {
        return null;
      }
      if (key.expiresAt > 0 && Date.now() > key.expiresAt) {
        await this.backend.delete(key.id);
        continue;
      }
      return key;
    }
  }

  /**
   * Delete a key.
   */
  async deleteKey(id: string): Promise<void> {
    await this.backend.delete(id);
  }

  /**
   * Get all keys of a specific type.
   */
  async getKeysByType(type: StoredKey['type']): Promise<StoredKey[]> {
    const keys = await this.backend.getAllByType(type);
    const now = Date.now();
    
    // Filter out expired keys
    const valid: StoredKey[] = [];
    for (const key of keys) {
      if (key.expiresAt > 0 && now > key.expiresAt) {
        await this.backend.delete(key.id);
      } else {
        valid.push(key);
      }
    }
    
    return valid;
  }

  /**
   * Clear all keys (for testing or logout).
   */
  async clear(): Promise<void> {
    await this.backend.clear();
  }

  /**
   * Create an in-memory store for testing.
   */
  static createMemoryStore(): KeyStore {
    return new KeyStore(new MemoryKeyStoreBackend());
  }
}
