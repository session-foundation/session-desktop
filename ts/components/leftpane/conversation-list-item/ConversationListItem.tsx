import { isNil } from 'lodash';
import { MouseEvent, ReactNode, useCallback } from 'react';
import clsx from 'clsx';

import { contextMenu } from 'react-contexify';
import { createPortal } from 'react-dom';

import { CSSProperties } from 'styled-components';
import { Avatar, AvatarSize } from '../../avatar/Avatar';

import {
  ContextConversationProvider,
  useConvoIdFromContext,
} from '../../../contexts/ConvoIdContext';
import { useHasUnread, useIsBlocked, useMentionedUs } from '../../../hooks/useParamSelector';
import { useIsSearchingForType } from '../../../state/selectors/search';
import { useSelectedConversationKey } from '../../../state/selectors/selectedConversation';
import { MemoConversationListItemContextMenu } from '../../menu/ConversationListItemContextMenu';
import { ConversationListItemHeaderItem } from './HeaderItem';
import { MessageItem } from './MessageItem';
import { openConversationWithMessages } from '../../../state/ducks/conversations';
import { useShowUserDetailsCbFromConversation } from '../../menuAndSettingsHooks/useShowUserDetailsCb';

const Portal = ({ children }: { children: ReactNode }) => {
  return createPortal(children, document.querySelector('.inbox.index') as Element);
};

const AvatarItem = () => {
  const conversationId = useConvoIdFromContext();

  const showUserDetailsCb = useShowUserDetailsCbFromConversation(conversationId, true);

  return (
    <div>
      <Avatar
        size={AvatarSize.S}
        pubkey={conversationId}
        onAvatarClick={showUserDetailsCb ?? undefined}
      />
    </div>
  );
};

type Props = { conversationId: string; style?: CSSProperties };

export const ConversationListItem = (props: Props) => {
  const { conversationId, style } = props;
  const key = `conversation-item-${conversationId}`;

  const hasUnread = useHasUnread(conversationId);

  let hasUnreadMentionedUs = useMentionedUs(conversationId);
  let isBlocked = useIsBlocked(conversationId);
  const isSearch = useIsSearchingForType('global');
  const selectedConvo = useSelectedConversationKey();

  const isSelectedConvo = conversationId === selectedConvo && !isNil(selectedConvo);

  if (isSearch) {
    // force isBlocked and hasUnreadMentionedUs to be false, we just want to display the row without any special style when showing search results
    hasUnreadMentionedUs = false;
    isBlocked = false;
  }

  const triggerId = `${key}-ctxmenu`;

  const openConvo = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      // mousedown is invoked sooner than onClick, but for both right and left click
      if (e.button === 0) {
        void openConversationWithMessages({ conversationKey: conversationId, messageId: null });
      }
    },
    [conversationId]
  );

  const extraStyle: CSSProperties = {};
  if (hasUnread) {
    extraStyle.background = 'var(--conversation-tab-background-unread-color)';
    extraStyle.borderLeft = '4px solid var(--conversation-tab-color-strip-color)';
  }

  if (hasUnreadMentionedUs) {
    extraStyle.borderLeft = '4px solid var(--conversation-tab-color-strip-color) !important';
  }

  if (isBlocked) {
    extraStyle.borderLeft = '4px solid var(--danger-color) !important;';
  }
  if (isSelectedConvo) {
    extraStyle.background = 'var(--conversation-tab-background-selected-color)';
  }

  return (
    <ContextConversationProvider value={conversationId}>
      <div key={key}>
        <div
          role="button"
          onMouseDown={openConvo}
          onMouseUp={e => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onContextMenu={e => {
            contextMenu.show({
              id: triggerId,
              event: e,
            });
          }}
          style={{
            ...style,
            ...extraStyle,
          }}
          className={clsx('module-conversation-list-item')}
        >
          <AvatarItem />
          <div className="module-conversation-list-item__content">
            <ConversationListItemHeaderItem />
            {!isSearch ? <MessageItem /> : null}
          </div>
        </div>
        <Portal>
          <MemoConversationListItemContextMenu triggerId={triggerId} />
        </Portal>
      </div>
    </ContextConversationProvider>
  );
};
