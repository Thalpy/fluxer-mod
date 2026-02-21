/*
 * React hooks for E2E integration.
 * 
 * These hooks make it easy to integrate E2E into the Fluxer app
 * with minimal code changes.
 */

import { useCallback, useEffect, useState } from 'react';
import { e2eManager, type ProcessedMessage } from '../E2EManager';

/**
 * Hook to check if a channel has E2E enabled.
 */
export function useIsSecureChannel(channelId: string): boolean {
  const [isSecure, setIsSecure] = useState(false);

  useEffect(() => {
    setIsSecure(e2eManager.isSecureChannel(channelId));
  }, [channelId]);

  return isSecure;
}

/**
 * Hook to manage E2E for a channel.
 */
export function useChannelE2E(channelId: string) {
  const [isSecure, setIsSecure] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsSecure(e2eManager.isSecureChannel(channelId));
  }, [channelId]);

  const enable = useCallback(async () => {
    setIsLoading(true);
    try {
      await e2eManager.enableE2E(channelId);
      setIsSecure(true);
    } finally {
      setIsLoading(false);
    }
  }, [channelId]);

  const disable = useCallback(async () => {
    await e2eManager.disableE2E(channelId);
    setIsSecure(false);
  }, [channelId]);

  return { isSecure, isLoading, enable, disable };
}

/**
 * Hook to encrypt a message before sending.
 */
export function useEncryptMessage(channelId: string) {
  const isSecure = useIsSecureChannel(channelId);

  const encrypt = useCallback(async (content: string): Promise<string> => {
    if (!isSecure) {
      return content;
    }
    return await e2eManager.encryptMessage(channelId, content);
  }, [channelId, isSecure]);

  return { encrypt, isSecure };
}

/**
 * Hook to process/decrypt an incoming message.
 */
export function useProcessMessage(channelId: string, content: string): ProcessedMessage | null {
  const [processed, setProcessed] = useState<ProcessedMessage | null>(null);

  useEffect(() => {
    let cancelled = false;

    e2eManager.processMessage(channelId, content).then((result) => {
      if (!cancelled) {
        setProcessed(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [channelId, content]);

  return processed;
}

/**
 * Hook to get/set E2E key for sharing.
 */
export function useE2EKeySharing(channelId: string) {
  const [exportedKey, setExportedKey] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const exportKey = useCallback(async () => {
    const key = await e2eManager.exportKey(channelId);
    setExportedKey(key);
    return key;
  }, [channelId]);

  const importKey = useCallback(async (keyString: string) => {
    const result = await e2eManager.importKey(keyString);
    setImportStatus(result.success ? 'success' : 'error');
    return result;
  }, []);

  return { exportedKey, exportKey, importKey, importStatus };
}

/**
 * Initialize E2E on app start.
 */
 * Initialize E2E on app start.
 */
export function useE2EInit() {
 const [initialized, setInitialized] = useState(false);

 useEffect(() => {
   let cancelled = false;

   e2eManager.initialize().then(() => {
     if (!cancelled) {
       setInitialized(true);
     }
   });

   return () => {
     cancelled = true;
   };
 }, []);

 return initialized;
}
