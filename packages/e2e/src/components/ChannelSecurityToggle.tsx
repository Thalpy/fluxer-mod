/*
 * Channel E2E Security Toggle
 * 
 * A simple toggle switch for enabling/disabling E2E encryption on a channel.
 * Place this in channel settings.
 */

import { useCallback, useState } from 'react';
import { useChannelE2E } from '../hooks/useE2E';

export interface ChannelSecurityToggleProps {
  channelId: string;
  channelName?: string;
  className?: string;
}

export function ChannelSecurityToggle({ 
  channelId, 
  channelName,
  className = '' 
}: ChannelSecurityToggleProps) {
  const { isSecure, isLoading, enable, disable } = useChannelE2E(channelId);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleToggle = useCallback(async () => {
    if (isSecure) {
      // Disabling - show confirmation
      setShowConfirm(true);
    } else {
      // Enabling - just do it
      await enable();
    }
  }, [isSecure, enable]);

  const handleConfirmDisable = useCallback(async () => {
    await disable();
    setShowConfirm(false);
  }, [disable]);

  return (
    <div className={`e2e-security-toggle ${className}`}>
      <div className="e2e-toggle-header">
        <div className="e2e-toggle-icon">
          {isSecure ? '🔒' : '🔓'}
        </div>
        <div className="e2e-toggle-info">
          <h4 className="e2e-toggle-title">End-to-End Encryption</h4>
          <p className="e2e-toggle-description">
            {isSecure 
              ? 'Messages in this channel are encrypted. Only members with the key can read them.'
              : 'Enable E2E encryption to secure messages in this channel.'}
          </p>
        </div>
      </div>

      <button
        className={`e2e-toggle-button ${isSecure ? 'enabled' : 'disabled'}`}
        onClick={handleToggle}
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : isSecure ? 'Enabled' : 'Enable'}
      </button>

      {showConfirm && (
        <div className="e2e-confirm-dialog">
          <div className="e2e-confirm-content">
            <h4>Disable E2E Encryption?</h4>
            <p>
              New messages will no longer be encrypted. 
              Old encrypted messages will still require the key to read.
            </p>
            <div className="e2e-confirm-buttons">
              <button 
                className="e2e-confirm-cancel"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="e2e-confirm-disable"
                onClick={handleConfirmDisable}
              >
                Disable E2E
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Minimal default styles (can be overridden)
export const channelSecurityToggleStyles = `
.e2e-security-toggle {
  padding: 16px;
  border-radius: 8px;
  background: var(--background-secondary, #2f3136);
}

.e2e-toggle-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.e2e-toggle-icon {
  font-size: 24px;
}

.e2e-toggle-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--header-primary, #fff);
}

.e2e-toggle-description {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted, #a3a6aa);
}

.e2e-toggle-button {
  width: 100%;
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.e2e-toggle-button.disabled {
  background: var(--brand-experiment, #5865f2);
  color: #fff;
}

.e2e-toggle-button.enabled {
  background: var(--green-360, #2d7d46);
  color: #fff;
}

.e2e-toggle-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.e2e-confirm-dialog {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.e2e-confirm-content {
  background: var(--background-primary, #36393f);
  padding: 24px;
  border-radius: 8px;
  max-width: 400px;
}

.e2e-confirm-content h4 {
  margin: 0 0 8px 0;
  color: var(--header-primary, #fff);
}

.e2e-confirm-content p {
  margin: 0 0 16px 0;
  color: var(--text-normal, #dcddde);
}

.e2e-confirm-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.e2e-confirm-cancel {
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: var(--text-normal, #dcddde);
  cursor: pointer;
}

.e2e-confirm-disable {
  padding: 8px 16px;
  background: var(--red-400, #d83c3e);
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
}
`;
