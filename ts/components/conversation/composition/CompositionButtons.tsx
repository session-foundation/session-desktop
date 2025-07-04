import { forwardRef } from 'react';
import styled from 'styled-components';
import { useIsOutgoingRequest } from '../../../hooks/useParamSelector';
import {
  useSelectedConversationKey,
  useSelectedIsBlocked,
} from '../../../state/selectors/selectedConversation';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import type { SessionIconSize } from '../../icon';

const StyledChatButtonContainer = styled.div<{ disabled?: boolean }>`
  cursor: ${props => (props.disabled ? 'not-allowed' : 'pointer')};
  pointer-events: ${props => (props.disabled ? 'none' : 'auto')};
`;

const sharedButtonProps = {
  iconColor: 'var(--chat-buttons-icon-color)',
  iconSize: 'large' satisfies SessionIconSize as SessionIconSize,
  backgroundColor: 'var(--chat-buttons-background-color)',
  padding: 'var(--margins-sm)',
};

export const AddStagedAttachmentButton = (props: { onClick: () => void }) => {
  const selectedConvoKey = useSelectedConversationKey();
  const isOutgoingRequest = useIsOutgoingRequest(selectedConvoKey);

  const isBlocked = useSelectedIsBlocked();
  const disabled = isOutgoingRequest || isBlocked;

  return (
    <StyledChatButtonContainer disabled={disabled}>
      <SessionLucideIconButton
        unicode={LUCIDE_ICONS_UNICODE.PLUS}
        onClick={props.onClick}
        dataTestId="attachments-button"
        disabled={disabled}
        {...sharedButtonProps}
      />
    </StyledChatButtonContainer>
  );
};

export const StartRecordingButton = (props: { onClick: () => void }) => {
  const selectedConvoKey = useSelectedConversationKey();
  const isOutgoingRequest = useIsOutgoingRequest(selectedConvoKey);
  const isBlocked = useSelectedIsBlocked();
  const disabled = isOutgoingRequest || isBlocked;

  return (
    <StyledChatButtonContainer disabled={disabled}>
      <SessionLucideIconButton
        unicode={LUCIDE_ICONS_UNICODE.MIC}
        onClick={props.onClick}
        disabled={disabled}
        dataTestId="microphone-button"
        {...sharedButtonProps}
      />
    </StyledChatButtonContainer>
  );
};

// eslint-disable-next-line react/display-name
export const ToggleEmojiButton = forwardRef<HTMLButtonElement, { onClick: () => void }>(
  (props, ref) => {
    return (
      <StyledChatButtonContainer>
        <SessionLucideIconButton
          unicode={LUCIDE_ICONS_UNICODE.SMILE_PLUS}
          ref={ref}
          onClick={props.onClick}
          dataTestId="emoji-button"
          {...sharedButtonProps}
        />
      </StyledChatButtonContainer>
    );
  }
);

export const SendMessageButton = (props: { onClick: () => void }) => {
  return (
    <StyledChatButtonContainer>
      <SessionLucideIconButton
        unicode={LUCIDE_ICONS_UNICODE.ARROW_UP}
        onClick={props.onClick}
        dataTestId="send-message-button"
        {...sharedButtonProps}
      />
    </StyledChatButtonContainer>
  );
};
