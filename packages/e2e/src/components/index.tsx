/*
 * E2E UI Components
 * 
 * Ready-to-use React components for E2E encryption UI.
 */

export { 
  ChannelSecurityToggle,
  channelSecurityToggleStyles,
  type ChannelSecurityToggleProps,
} from './ChannelSecurityToggle';

export {
  E2EBadge,
  E2ELockIcon,
  E2EMessageIndicator,
  e2eBadgeStyles,
  type E2EBadgeProps,
} from './E2EBadge';

export {
  KeySharingDialog,
  keySharingDialogStyles,
  type KeySharingDialogProps,
} from './KeySharingDialog';

// Combined styles for convenience
export const allE2EStyles = `
${channelSecurityToggleStyles}
${e2eBadgeStyles}
${keySharingDialogStyles}
`;
