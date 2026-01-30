import { forwardRef } from 'react';
import { useIsOutgoingRequest } from '../../../hooks/useParamSelector';
import {
  useSelectedConversationKey,
  useSelectedIsBlocked,
} from '../../../state/selectors/selectedConversation';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import type { SessionIconSize } from '../../icon';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';
import { KbdShortcut } from '../../../util/keyboardShortcuts';

type CompositionButtonProps = {
  onClick: () => void;
};

const getSharedButtonProps = (disabled?: boolean) => ({
  iconColor: disabled ? 'var(--disabled-color)' : 'var(--chat-buttons-icon-color)',
  iconSize: 'large' satisfies SessionIconSize as SessionIconSize,
  backgroundColor: 'var(--chat-buttons-background-color)',
  padding: 'var(--margins-sm)',
});

export const AddStagedAttachmentButton = ({ onClick }: CompositionButtonProps) => {
  const selectedConvoKey = useSelectedConversationKey();
  const isOutgoingRequest = useIsOutgoingRequest(selectedConvoKey);

  const isBlocked = useSelectedIsBlocked();
  const disabled = isOutgoingRequest || isBlocked;

  useKeyboardShortcut(KbdShortcut.conversationUploadAttachment, onClick, disabled);
  return (
    <SessionLucideIconButton
      unicode={LUCIDE_ICONS_UNICODE.PLUS}
      onClick={onClick}
      dataTestId="attachments-button"
      disabled={disabled}
      {...getSharedButtonProps(disabled)}
    />
  );
};

export const StartRecordingButton = ({ onClick }: CompositionButtonProps) => {
  const selectedConvoKey = useSelectedConversationKey();
  const isOutgoingRequest = useIsOutgoingRequest(selectedConvoKey);
  const isBlocked = useSelectedIsBlocked();
  const disabled = isOutgoingRequest || isBlocked;

  return (
    <SessionLucideIconButton
      unicode={LUCIDE_ICONS_UNICODE.MIC}
      onClick={onClick}
      disabled={disabled}
      dataTestId="microphone-button"
      {...getSharedButtonProps(disabled)}
    />
  );
};

export const ToggleEmojiButton = forwardRef<HTMLButtonElement, CompositionButtonProps>(
  (props, ref) => {
    useKeyboardShortcut(KbdShortcut.conversationToggleEmojiPicker, props.onClick);
    return (
      <SessionLucideIconButton
        unicode={LUCIDE_ICONS_UNICODE.SMILE_PLUS}
        ref={ref}
        onClick={props.onClick}
        dataTestId="emoji-button"
        {...getSharedButtonProps(false)}
      />
    );
  }
);

export const SendMessageButton = ({ onClick }: CompositionButtonProps) => {
  const disabled = useSelectedIsBlocked();
  return (
    <SessionLucideIconButton
      unicode={LUCIDE_ICONS_UNICODE.ARROW_UP}
      onClick={onClick}
      disabled={disabled}
      dataTestId="send-message-button"
      {...getSharedButtonProps(disabled)}
      backgroundColor={'var(--primary-color)'}
      iconColor={'var(--background-primary-color)'}
    />
  );
};
