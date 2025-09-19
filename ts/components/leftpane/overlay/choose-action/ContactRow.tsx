import { createPortal } from 'react-dom';
import { contextMenu } from 'react-contexify';
import type { ReactNode } from 'react';
import styled, { CSSProperties } from 'styled-components';

import { openConversationWithMessages } from '../../../../state/ducks/conversations';
import { Avatar, AvatarSize } from '../../../avatar/Avatar';
import { useShowUserDetailsCbFromConversation } from '../../../menuAndSettingsHooks/useShowUserDetailsCb';
import { ContactName } from '../../../conversation/ContactName/ContactName';
import { MemoConversationListItemContextMenu } from '../../../menu/ConversationListItemContextMenu';
import { ContextConversationProvider } from '../../../../contexts/ConvoIdContext';

const Portal = ({ children }: { children: ReactNode }) => {
  return createPortal(children, document.querySelector('.inbox.index') as Element);
};

type Props = { id: string; displayName?: string; style: CSSProperties };

const StyledAvatarItem = styled.div`
  padding-right: var(--margins-sm);
`;

const AvatarItem = (props: Pick<Props, 'id'>) => {
  const { id } = props;

  const showUserDetailsFromConversationCb =
    useShowUserDetailsCbFromConversation(id, true) ?? undefined;

  return (
    <StyledAvatarItem>
      <Avatar size={AvatarSize.S} pubkey={id} onAvatarClick={showUserDetailsFromConversationCb} />
    </StyledAvatarItem>
  );
};

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
  const { id, style } = props;
  const triggerId = `contact-row-${id}-ctxmenu`;

  return (
    <ContextConversationProvider value={id}>
      <StyledRowContainer
        style={style}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={async () => openConversationWithMessages({ conversationKey: id, messageId: null })}
        onContextMenu={e => {
          contextMenu.show({
            id: triggerId,
            event: e,
          });
        }}
      >
        <AvatarItem id={id} />
        <ContactName
          data-testid="module-conversation__user__profile-name"
          pubkey={id}
          contactNameContext="contact-list-row"
          extraNameStyle={{
            color: 'var(--text-primary-color)',
            fontSize: 'var(--font-size-lg)',
          }}
        />
        <Portal>
          <MemoConversationListItemContextMenu triggerId={triggerId} />
        </Portal>
      </StyledRowContainer>
    </ContextConversationProvider>
  );
};
