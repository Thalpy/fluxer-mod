/*
 * E2E Badge Component
 * 
 * A small lock icon badge to show that a channel has E2E encryption enabled.
 * Use this next to channel names in the sidebar.
 */

import { useIsSecureChannel } from '../hooks/useE2E';

export interface E2EBadgeProps {
  channelId: string;
  className?: string;
  showTooltip?: boolean;
}

/**
 * Shows a 🔒 badge if the channel has E2E enabled.
 * Returns null if E2E is not enabled for the channel.
 */
export function E2EBadge({ 
  channelId, 
  className = '',
  showTooltip = true 
}: E2EBadgeProps) {
  const isSecure = useIsSecureChannel(channelId);

  if (!isSecure) {
    return null;
  }

  return (
    <span 
      className={`e2e-badge ${className}`}
      title={showTooltip ? 'End-to-end encrypted' : undefined}
      aria-label="End-to-end encrypted"
    >
      🔒
    </span>
  );
}

/**
 * Inline lock icon for use in text/headers.
 */
export function E2ELockIcon({ className = '' }: { className?: string }) {
  return (
    <span className={`e2e-lock-icon ${className}`} aria-hidden="true">
      🔒
    </span>
  );
}

/**
 * E2E indicator for message display.
 * Shows when viewing an encrypted message.
 */
export function E2EMessageIndicator({ 
  isEncrypted,
  hasError,
  className = '' 
}: { 
  isEncrypted: boolean;
  hasError?: boolean;
  className?: string;
}) {
  if (!isEncrypted) {
    return null;
  }

  return (
    <span 
      className={`e2e-message-indicator ${hasError ? 'error' : ''} ${className}`}
      title={hasError ? 'Decryption failed' : 'End-to-end encrypted'}
    >
      {hasError ? '🔓' : '🔒'}
    </span>
  );
}

// Minimal styles
export const e2eBadgeStyles = `
.e2e-badge {
  font-size: 12px;
  margin-left: 4px;
  opacity: 0.8;
  cursor: default;
}

.e2e-lock-icon {
  font-size: inherit;
}

.e2e-message-indicator {
  font-size: 12px;
  margin-right: 4px;
}

.e2e-message-indicator.error {
  color: var(--red-400, #d83c3e);
}
`;
