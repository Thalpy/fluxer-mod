/*
 * @fluxer/e2e - End-to-end encryption layer for Fluxer
 * 
 * This package provides opt-in E2E encryption for DMs and secure channels.
 * Designed to be minimally invasive to upstream Fluxer code.
 */

// Core
export { E2EManager, e2eManager } from './E2EManager';
export { KeyStore, type StoredKey } from './store/KeyStore';
export { ChannelKeyManager } from './store/ChannelKeyManager';

// Crypto primitives
export { 
  generateKeyPair,
  deriveSharedSecret,
  encrypt,
  decrypt,
  type E2EKeyPair,
  type EncryptedPayload,
} from './crypto/Crypto';

// Message format
export {
  E2E_MESSAGE_PREFIX,
  isE2EMessage,
  wrapE2EMessage,
  unwrapE2EMessage,
  type E2EMessageEnvelope,
} from './crypto/MessageFormat';

// React hooks
export {
  useIsSecureChannel,
  useChannelE2E,
  useEncryptMessage,
  useProcessMessage,
  useE2EKeySharing,
  useE2EInit,
} from './hooks/useE2E';

// UI Components
export {
  ChannelSecurityToggle,
  E2EBadge,
  E2ELockIcon,
  E2EMessageIndicator,
  KeySharingDialog,
  allE2EStyles,
  channelSecurityToggleStyles,
  e2eBadgeStyles,
  keySharingDialogStyles,
} from './components';
