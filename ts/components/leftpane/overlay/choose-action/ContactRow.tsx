import styled, { CSSProperties } from 'styled-components';
import { openConversationWithMessages } from '../../../../state/ducks/conversations';
import { Avatar, AvatarSize } from '../../../avatar/Avatar';
import { useShowUserDetailsCbFromConversation } from '../../../menuAndSettingsHooks/useShowUserDetailsCb';

type Props = { id: string; displayName?: string; style: CSSProperties };

const StyledAvatarItem = styled.div`
  padding-right: var(--margins-sm);
`;

const AvatarItem = (props: Pick<Props, 'id'>) => {
  const { id } = props;

  const showUserDetailsFromConversationCb = useShowUserDetailsCbFromConversation(id) ?? undefined;

  return (
    <StyledAvatarItem>
      <Avatar size={AvatarSize.S} pubkey={id} onAvatarClick={showUserDetailsFromConversationCb} />
    </StyledAvatarItem>
  );
};

const StyledContactRowName = styled.div`
  color: var(--text-primary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-lg);
`;

const StyledRowContainer = styled.button`
  display: flex;
  align-items: center;
  padding: 0 var(--margins-lg);
  transition: background-color var(--default-duration) linear;
  cursor: pointer;

  &:hover {
    background-color: var(--conversation-tab-background-hover-color);
  }
`;

const StyledBreak = styled.div`
  display: flex;
  align-items: center;
  padding: 0 var(--margins-lg);
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  height: var(--contact-row-break-width);
`;

export const ContactRowBreak = (props: { char: string; key: string; style: CSSProperties }) => {
  const { char, key, style } = props;

  return (
    <StyledBreak key={key} style={style}>
      {char}
    </StyledBreak>
  );
};

export const ContactRow = (props: Props) => {
  const { id, style, displayName } = props;

  return (
    <StyledRowContainer
      style={style}
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onClick={async () => openConversationWithMessages({ conversationKey: id, messageId: null })}
    >
      <AvatarItem id={id} />
      <StyledContactRowName data-testid="module-conversation__user__profile-name">
        {displayName || id}
      </StyledContactRowName>
    </StyledRowContainer>
  );
};
