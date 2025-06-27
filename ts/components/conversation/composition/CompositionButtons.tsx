import { forwardRef } from 'react';
import styled from 'styled-components';
import { useIsOutgoingRequest } from '../../../hooks/useParamSelector';
import {
  useSelectedConversationKey,
  useSelectedIsBlocked,
} from '../../../state/selectors/selectedConversation';
import { SessionIconButton } from '../../icon';

type CompositionButtonProps = {
  onClick: () => void;
};

const StyledChatButtonContainer = styled.div<{
  disabled?: boolean;
  backgroundColor?: string;
  backgroundColorHover?: string;
}>`
  .session-icon-button {
    svg {
      background-color: ${props => props.backgroundColor || 'var(--chat-buttons-background-color)'};
    }

    ${props =>
      !props.disabled &&
      `&:hover svg {
      background-color: ${props.backgroundColorHover || 'var(--chat-buttons-background-hover-color)'};
    }`}

    ${props =>
      props.disabled &&
      `svg path {
      fill: var(--disabled-color);
    }`}
  }
`;

export const AddStagedAttachmentButton = ({ onClick }: CompositionButtonProps) => {
  const selectedConvoKey = useSelectedConversationKey();
  const isOutgoingRequest = useIsOutgoingRequest(selectedConvoKey);

  const isBlocked = useSelectedIsBlocked();
  const disabled = isOutgoingRequest || isBlocked;

  return (
    <StyledChatButtonContainer disabled={disabled}>
      <SessionIconButton
        iconType="plusThin"
        iconColor={'var(--chat-buttons-icon-color)'}
        iconSize={'huge2'}
        borderRadius="300px"
        iconPadding="8px"
        onClick={onClick}
        dataTestId="attachments-button"
        disabled={disabled}
      />
    </StyledChatButtonContainer>
  );
};

export const StartRecordingButton = ({ onClick }: CompositionButtonProps) => {
  const selectedConvoKey = useSelectedConversationKey();
  const isOutgoingRequest = useIsOutgoingRequest(selectedConvoKey);
  const isBlocked = useSelectedIsBlocked();
  const disabled = isOutgoingRequest || isBlocked;

  return (
    <StyledChatButtonContainer disabled={disabled}>
      <SessionIconButton
        iconType="microphone"
        iconSize={'huge2'}
        iconColor={'var(--chat-buttons-icon-color)'}
        borderRadius="300px"
        iconPadding="6px"
        onClick={onClick}
        disabled={disabled}
        dataTestId="microphone-button"
      />
    </StyledChatButtonContainer>
  );
};

export const ToggleEmojiButton = forwardRef<HTMLButtonElement, CompositionButtonProps>(
  (props, ref) => {
    return (
      <StyledChatButtonContainer>
        <SessionIconButton
          iconType="emoji"
          ref={ref}
          iconColor={'var(--chat-buttons-icon-color)'}
          iconSize={'huge2'}
          borderRadius="300px"
          iconPadding="6px"
          onClick={props.onClick}
          dataTestId="emoji-button"
        />
      </StyledChatButtonContainer>
    );
  }
);

export const SendMessageButton = ({ onClick }: CompositionButtonProps) => {
  const isBlocked = useSelectedIsBlocked();
  return (
    <StyledChatButtonContainer disabled={isBlocked} backgroundColor={'var(--primary-color)'}>
      <SessionIconButton
        iconType="send"
        iconColor={'var(--background-primary-color)'}
        iconSize={'huge2'}
        iconRotation={90}
        borderRadius="300px"
        iconPadding="6px"
        onClick={onClick}
        dataTestId="send-message-button"
        disabled={isBlocked}
      />
    </StyledChatButtonContainer>
  );
};
