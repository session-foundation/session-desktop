import { forwardRef } from 'react';
import styled from 'styled-components';
import { useIsOutgoingRequest } from '../../../hooks/useParamSelector';
import { useSelectedConversationKey } from '../../../state/selectors/selectedConversation';
import { SessionIconButton } from '../../icon';

type CompositionButtonProps = {
  onClick: () => void;
  isBlocked?: boolean;
};

const StyledChatButtonContainer = styled.div<{ disabled?: boolean }>`
  .session-icon-button {
    svg {
      background-color: var(--chat-buttons-background-color);
    }

    ${props =>
      !props.disabled &&
      `&:hover svg {
      background-color: var(--chat-buttons-background-hover-color);
    }`}

    ${props =>
      props.disabled &&
      `svg path {
      fill: var(--disabled-color);
    }`}
  }
`;

export const AddStagedAttachmentButton = ({ onClick, isBlocked }: CompositionButtonProps) => {
  const selectedConvoKey = useSelectedConversationKey();
  const isOutgoingRequest = useIsOutgoingRequest(selectedConvoKey);

  const disabled = isOutgoingRequest || isBlocked;

  return (
    <StyledChatButtonContainer disabled={disabled}>
      <SessionIconButton
        iconType="plusThin"
        backgroundColor={'var(--chat-buttons-background-color)'}
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

export const StartRecordingButton = ({ onClick, isBlocked }: CompositionButtonProps) => {
  const selectedConvoKey = useSelectedConversationKey();
  const isOutgoingRequest = useIsOutgoingRequest(selectedConvoKey);

  const disabled = isOutgoingRequest || isBlocked;

  return (
    <StyledChatButtonContainer disabled={disabled}>
      <SessionIconButton
        iconType="microphone"
        iconSize={'huge2'}
        backgroundColor={'var(--chat-buttons-background-color)'}
        iconColor={'var(--chat-buttons-icon-color)'}
        borderRadius="300px"
        iconPadding="6px"
        onClick={onClick}
        dataTestId="microphone-button"
        disabled={disabled}
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
          backgroundColor={'var(--chat-buttons-background-color)'}
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

export const SendMessageButton = ({ onClick, isBlocked }: CompositionButtonProps) => {
  return (
    <StyledChatButtonContainer disabled={isBlocked}>
      <SessionIconButton
        iconType="send"
        backgroundColor={'var(--chat-buttons-background-color)'}
        iconColor={'var(--chat-buttons-icon-color)'}
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
