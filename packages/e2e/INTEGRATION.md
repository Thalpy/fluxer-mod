# E2E Integration Guide

This guide shows how to integrate the `@fluxer/e2e` package into the Fluxer app.

## Overview

The E2E layer requires minimal changes to upstream code:

1. **Initialize** E2E on app start
2. **Encrypt** messages before sending (for secure channels)
3. **Decrypt** messages when displaying (for E2E messages)
4. **UI** to enable/disable E2E per channel

## Step 1: Initialize E2E

In `fluxer_app/src/App.tsx`, add initialization:

```tsx
import { useE2EInit } from '@fluxer/e2e/hooks/useE2E';

function App() {
  const e2eReady = useE2EInit();
  
  // ... rest of app
}
```

## Step 2: Encrypt Messages Before Sending

In `fluxer_app/src/actions/MessageActionCreators.tsx`, modify `sendMessage`:

```tsx
import { e2eManager } from '@fluxer/e2e';

export async function sendMessage(params: SendMessageParams): Promise<void> {
  let content = params.content;
  
  // Encrypt if this is a secure channel
  if (e2eManager.isSecureChannel(params.channelId)) {
    content = await e2eManager.encryptMessage(params.channelId, content);
  }
  
  // ... rest of existing sendMessage logic with `content`
}
```

**Lines changed:** ~5 lines added

## Step 3: Decrypt Messages When Displaying

In your message display component (e.g., `Message.tsx` or similar):

```tsx
import { useProcessMessage } from '@fluxer/e2e/hooks/useE2E';

function MessageContent({ channelId, content }: Props) {
  const processed = useProcessMessage(channelId, content);
  
  if (!processed) {
    return <LoadingSpinner />;
  }
  
  return (
    <div className={processed.isEncrypted ? 'message-encrypted' : ''}>
      {processed.isEncrypted && <LockIcon />}
      {processed.content}
      {processed.error && <span className="error">{processed.error}</span>}
    </div>
  );
}
```

## Step 4: Add E2E Toggle UI

Use the pre-built component in channel settings:

```tsx
import { ChannelSecurityToggle, allE2EStyles } from '@fluxer/e2e';

// Add styles once (in your app's CSS or a style tag)
const styleSheet = document.createElement('style');
styleSheet.textContent = allE2EStyles;
document.head.appendChild(styleSheet);

// In channel settings
function ChannelSettings({ channelId, channelName }: Props) {
  return (
    <div>
      {/* Other settings... */}
      
      <ChannelSecurityToggle 
        channelId={channelId}
        channelName={channelName}
      />
    </div>
  );
}
```

## Step 5: Add Lock Badge to Channel List

Show a 🔒 badge on encrypted channels:

```tsx
import { E2EBadge } from '@fluxer/e2e';

function ChannelListItem({ channel }: Props) {
  return (
    <div className="channel-item">
      <span className="channel-name">{channel.name}</span>
      <E2EBadge channelId={channel.id} />
    </div>
  );
}
```

## Step 6: Key Sharing Dialog

Add a way for users to share channel keys:

```tsx
import { KeySharingDialog } from '@fluxer/e2e';
import { useState } from 'react';

function ChannelHeader({ channelId, channelName }: Props) {
  const [showKeyDialog, setShowKeyDialog] = useState(false);

  return (
    <div>
      <button onClick={() => setShowKeyDialog(true)}>
        🔑 Manage Keys
      </button>
      
      <KeySharingDialog
        channelId={channelId}
        channelName={channelName}
        isOpen={showKeyDialog}
        onClose={() => setShowKeyDialog(false)}
      />
    </div>
  );
}
```

## Step 7: Show Encryption Status on Messages

Indicate when a message is encrypted:

```tsx
import { E2EMessageIndicator, useProcessMessage } from '@fluxer/e2e';

function Message({ channelId, message }: Props) {
  const processed = useProcessMessage(channelId, message.content);
  
  if (!processed) {
    return <div>Loading...</div>;
  }

  return (
    <div className="message">
      <E2EMessageIndicator 
        isEncrypted={processed.isEncrypted}
        hasError={!!processed.error}
      />
      <span className="content">{processed.content}</span>
    </div>
  );
}
```

## Files Modified Summary

| File | Changes |
|------|---------|
| `App.tsx` | +2 lines (import + hook) |
| `MessageActionCreators.tsx` | +5 lines (import + encrypt) |
| `Message.tsx` or display component | +10 lines (hook + conditional render) |
| New: `ChannelSecuritySettings.tsx` | ~30 lines (new component) |
| New: `KeySharingDialog.tsx` | ~40 lines (new component) |

**Total upstream modifications:** ~17 lines in 3 existing files.

## Testing

Run E2E tests to verify everything works:

```bash
cd packages/e2e
pnpm test
```

Run upstream tests to verify we didn't break anything:

```bash
pnpm test
```

## Git Strategy

Keep your changes minimal and in separate commits:

```bash
git add packages/e2e
git commit -m "feat: add E2E encryption package"

git add fluxer_app/src/actions/MessageActionCreators.tsx
git commit -m "feat: integrate E2E encryption for messages"

git add fluxer_app/src/components/Message.tsx
git commit -m "feat: decrypt E2E messages on display"
```

This makes upstream merges easier - conflicts will only be in the 3 modified files.
