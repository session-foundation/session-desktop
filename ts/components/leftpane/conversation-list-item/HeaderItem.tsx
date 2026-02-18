import { MouseEvent } from 'react';
import clsx from 'clsx';
import styled from 'styled-components';
import { useConvoIdFromContext } from '../../../contexts/ConvoIdContext';
import { Data } from '../../../data/data';
import {
  useActiveAt,
  useHasUnread,
  useIsForcedUnreadWithoutUnreadMsg,
  useIsPinned,
  useMentionedUs,
  useNotificationSetting,
  useUnreadCount,
} from '../../../hooks/useParamSelector';
import { Constants } from '../../../session';
import {
  openConversationToSpecificMessage,
  openConversationWithMessages,
} from '../../../state/ducks/conversations';
import { useIsSearchingForType } from '../../../state/selectors/search';
import { Timestamp } from '../../conversation/Timestamp';
import { SessionIcon } from '../../icon';
import { UserItem } from './UserItem';
import type { WithConvoId } from '../../../session/types/with';
import { MailWithUnreadIcon } from '../../icon/MailWithUnreadIcon';

const NotificationSettingIcon = () => {
  const convoId = useConvoIdFromContext();
  const convoSetting = useNotificationSetting(convoId);

  switch (convoSetting) {
    case 'all':
      return null;
    case 'disabled':
      return (
        <SessionIcon
          iconType="mute"
          iconColor="currentColor"
          iconSize="small"
          style={{ flexShrink: 0 }}
        />
      );
    case 'mentions_only':
      return (
        <SessionIcon
          iconType="bell"
          iconColor="currentColor"
          iconSize="small"
          style={{ flexShrink: 0 }}
        />
      );
    default:
      return null;
  }
};

const StyledConversationListItemIconWrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: var(--margins-xs);
  align-items: center;
`;

const PinIcon = () => {
  const conversationId = useConvoIdFromContext();

  const isPinned = useIsPinned(conversationId);

  return isPinned ? (
    <SessionIcon
      iconType="pin"
      iconColor="currentColor"
      iconSize="small"
      style={{ flexShrink: 0 }}
    />
  ) : null;
};

const ListItemIcons = ({ conversationId }: WithConvoId) => {
  const isSearching = useIsSearchingForType('global');

  if (isSearching) {
    return null;
  }

  return (
    <StyledConversationListItemIconWrapper>
      <PinIcon />
      <NotificationSettingIcon />
      <UnreadCount conversationId={conversationId} />
      <AtSymbol conversationId={conversationId} />
    </StyledConversationListItemIconWrapper>
  );
};

const MentionAtSymbol = styled.span`
  background: var(--primary-color);
  color: var(--black-color);
  text-align: center;
  margin-top: 0px;
  margin-bottom: 0px;
  position: static;

  font-weight: 700;
  font-size: var(--font-size-xs);
  letter-spacing: 0.25px;

  height: 16px;
  min-width: 16px;
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    filter: grayscale(0.7);
  }
`;

/**
 * When clicking on the `@` symbol of a conversation, we open the conversation to the first unread message tagging us (with the @pubkey syntax)
 */
async function openConvoToLastMention(e: MouseEvent<HTMLSpanElement>, conversationId: string) {
  e.stopPropagation();
  e.preventDefault();

  // mousedown is invoked sooner than onClick, but for both right and left click
  if (e.button === 0) {
    const oldestMessageUnreadWithMention =
      (await Data.getFirstUnreadMessageWithMention(conversationId)) || null;
    if (oldestMessageUnreadWithMention) {
      await openConversationToSpecificMessage({
        conversationKey: conversationId,
        messageIdToNavigateTo: oldestMessageUnreadWithMention,
        shouldHighlightMessage: true,
      });
    } else {
      window.log.info('cannot open to latest mention as no unread mention are found');
      await openConversationWithMessages({
        conversationKey: conversationId,
        messageId: null,
      });
    }
  }
}

const AtSymbol = ({ conversationId }: WithConvoId) => {
  const hasMentionedUs = useMentionedUs(conversationId);
  const hasUnread = useHasUnread(conversationId);

  return hasMentionedUs && hasUnread ? (
    <MentionAtSymbol
      title="Open to latest mention"
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onMouseDown={async e => openConvoToLastMention(e, conversationId)}
    >
      @
    </MentionAtSymbol>
  ) : null;
};

const StyledUnreadCount = styled.p`
  background-color: var(--primary-color);
  text-align: center;
  padding-top: 1px;
  font-size: var(--font-size-xs);
  letter-spacing: 0.25px;
  height: 16px;
  min-width: 16px;
  line-height: 16px;
  border-radius: 8px;
  color: var(--black-color);
  font-weight: 700;
  margin: 0px;
  padding-inline: 3px;
  flex-shrink: 0;
`;

const UnreadCount = ({ conversationId }: WithConvoId) => {
  const unreadMsgCount = useUnreadCount(conversationId);
  const forcedUnread = useIsForcedUnreadWithoutUnreadMsg(conversationId);

  const unreadWithOverflow =
    unreadMsgCount > Constants.CONVERSATION.MAX_CONVO_UNREAD_COUNT
      ? `${Constants.CONVERSATION.MAX_CONVO_UNREAD_COUNT}+`
      : unreadMsgCount || ' ';

  if (forcedUnread) {
    return <MailWithUnreadIcon iconSize="small" style={{ maxHeight: '100%' }} />;
  }

  if (unreadMsgCount <= 0) {
    return null;
  }

  return <StyledUnreadCount>{unreadWithOverflow}</StyledUnreadCount>;
};

export const ConversationListItemHeaderItem = () => {
  const conversationId = useConvoIdFromContext();

  const isSearching = useIsSearchingForType('global');

  const hasUnread = useHasUnread(conversationId);
  const activeAt = useActiveAt(conversationId);

  return (
    <div className="module-conversation-list-item__header">
      <div className={clsx('module-conversation-list-item__header__name')}>
        <UserItem />
      </div>
      <ListItemIcons conversationId={conversationId} />

      {!isSearching && (
        <div
          className={clsx(
            'module-conversation-list-item__header__date',
            hasUnread ? 'module-conversation-list-item__header__date--has-unread' : null
          )}
        >
          <Timestamp timestamp={activeAt} isConversationSearchResult={false} />
        </div>
      )}
    </div>
  );
};
