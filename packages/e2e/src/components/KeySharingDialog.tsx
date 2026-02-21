/*
 * Key Sharing Dialog
 * 
 * Allows users to export and import encryption keys for a channel.
 * This is how users share E2E access with each other.
 */

import { useCallback, useState } from 'react';
import { useE2EKeySharing, useChannelE2E } from '../hooks/useE2E';

export interface KeySharingDialogProps {
  channelId: string;
  channelName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function KeySharingDialog({
  channelId,
  channelName = 'this channel',
  isOpen,
  onClose,
}: KeySharingDialogProps) {
  const { isSecure } = useChannelE2E(channelId);
  const { exportedKey, exportKey, importKey, importStatus } = useE2EKeySharing(channelId);
  const [importValue, setImportValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  const handleExport = useCallback(async () => {
    await exportKey();
    setCopied(false);
  }, [exportKey]);

  const handleCopy = useCallback(async () => {
    if (exportedKey) {
      await navigator.clipboard.writeText(exportedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [exportedKey]);

  const handleImport = useCallback(async () => {
    if (importValue.trim()) {
      const result = await importKey(importValue.trim());
      if (result.success) {
        setImportValue('');
        // Could auto-close or show success
      }
    }
  }, [importValue, importKey]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="e2e-dialog-overlay" onClick={onClose}>
      <div className="e2e-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="e2e-dialog-header">
          <h3>🔒 E2E Key Management</h3>
          <button className="e2e-dialog-close" onClick={onClose}>×</button>
        </div>

        <div className="e2e-dialog-tabs">
          <button
            className={`e2e-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            Share Key
          </button>
          <button
            className={`e2e-tab ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            Import Key
          </button>
        </div>

        <div className="e2e-dialog-content">
          {activeTab === 'export' ? (
            <div className="e2e-export-section">
              {!isSecure ? (
                <p className="e2e-warning">
                  E2E is not enabled for {channelName}. Enable it first to share keys.
                </p>
              ) : (
                <>
                  <p>Share this key with others so they can read encrypted messages:</p>
                  
                  {!exportedKey ? (
                    <button className="e2e-button primary" onClick={handleExport}>
                      Generate Shareable Key
                    </button>
                  ) : (
                    <div className="e2e-key-display">
                      <textarea
                        readOnly
                        value={exportedKey}
                        className="e2e-key-textarea"
                        onClick={(e) => e.currentTarget.select()}
                      />
                      <button className="e2e-button" onClick={handleCopy}>
                        {copied ? '✓ Copied!' : 'Copy to Clipboard'}
                      </button>
                      <p className="e2e-hint">
                        Send this key securely to the person you want to share with.
                        Anyone with this key can read messages in {channelName}.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="e2e-import-section">
              <p>Paste a key that was shared with you:</p>
              
              <textarea
                value={importValue}
                onChange={(e) => setImportValue(e.target.value)}
                placeholder="Paste the encryption key here..."
                className="e2e-key-textarea"
              />

              {importStatus === 'success' && (
                <p className="e2e-success">✓ Key imported successfully!</p>
              )}
              {importStatus === 'error' && (
                <p className="e2e-error">✗ Invalid key. Please check and try again.</p>
              )}

              <button 
                className="e2e-button primary"
                onClick={handleImport}
                disabled={!importValue.trim()}
              >
                Import Key
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Styles
export const keySharingDialogStyles = `
.e2e-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.e2e-dialog {
  background: var(--background-primary, #36393f);
  border-radius: 8px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.e2e-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--background-modifier-accent, #4f545c);
}

.e2e-dialog-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--header-primary, #fff);
}

.e2e-dialog-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--interactive-normal, #b9bbbe);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.e2e-dialog-close:hover {
  color: var(--interactive-hover, #dcddde);
}

.e2e-dialog-tabs {
  display: flex;
  border-bottom: 1px solid var(--background-modifier-accent, #4f545c);
}

.e2e-tab {
  flex: 1;
  padding: 12px 16px;
  background: none;
  border: none;
  color: var(--text-muted, #a3a6aa);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.e2e-tab:hover {
  color: var(--interactive-hover, #dcddde);
}

.e2e-tab.active {
  color: var(--header-primary, #fff);
  border-bottom-color: var(--brand-experiment, #5865f2);
}

.e2e-dialog-content {
  padding: 20px;
  overflow-y: auto;
}

.e2e-dialog-content p {
  margin: 0 0 16px 0;
  color: var(--text-normal, #dcddde);
  font-size: 14px;
}

.e2e-key-textarea {
  width: 100%;
  height: 100px;
  padding: 12px;
  border: 1px solid var(--background-modifier-accent, #4f545c);
  border-radius: 4px;
  background: var(--background-secondary, #2f3136);
  color: var(--text-normal, #dcddde);
  font-family: monospace;
  font-size: 12px;
  resize: none;
  margin-bottom: 12px;
}

.e2e-key-textarea:focus {
  outline: none;
  border-color: var(--brand-experiment, #5865f2);
}

.e2e-button {
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: var(--background-secondary-alt, #292b2f);
  color: var(--text-normal, #dcddde);
}

.e2e-button:hover {
  background: var(--background-modifier-hover, #393c43);
}

.e2e-button.primary {
  background: var(--brand-experiment, #5865f2);
  color: #fff;
}

.e2e-button.primary:hover {
  background: var(--brand-experiment-560, #4752c4);
}

.e2e-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.e2e-hint {
  font-size: 12px;
  color: var(--text-muted, #a3a6aa);
  margin-top: 12px;
}

.e2e-warning {
  color: var(--text-warning, #faa61a);
}

.e2e-success {
  color: var(--green-360, #3ba55c);
}

.e2e-error {
  color: var(--red-400, #d83c3e);
}

.e2e-key-display {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
`;
