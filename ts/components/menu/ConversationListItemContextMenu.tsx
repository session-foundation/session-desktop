import { Menu } from 'react-contexify';

import { useSelector } from 'react-redux';
import { useConvoIdFromContext } from '../../contexts/ConvoIdContext';
import { useIsPinned, useIsPrivate, useIsPrivateAndFriend } from '../../hooks/useParamSelector';
import { ConvoHub } from '../../session/conversations';
import {
  getIsMessageRequestOverlayShown,
  getIsMessageSection,
} from '../../state/selectors/section';
import { useIsSearching } from '../../state/selectors/search';
import { SessionContextMenuContainer } from '../SessionContextMenuContainer';
import {
  AcceptMsgRequestMenuItem,
  BanMenuItem,
  BlockMenuItem,
  ChangeNicknameMenuItem,
  ClearNicknameMenuItem,
  DeclineAndBlockMsgRequestMenuItem,
  DeclineMsgRequestMenuItem,
  DeleteMessagesMenuItem,
  DeletePrivateConversationMenuItem,
  InviteContactMenuItem,
  LeaveGroupOrCommunityMenuItem,
  MarkAllReadMenuItem,
  MarkConversationUnreadMenuItem,
  NotificationForConvoMenuItem,
  ShowUserDetailsMenuItem,
  UnbanMenuItem,
} from './Menu';
import { CopyCommunityUrlMenuItem } from './items/CopyCommunityUrl/CopyCommunityUrlMenuItem';
import { CopyAccountIdMenuItem } from './items/CopyAccountId/CopyAccountIdMenuItem';
import { ItemWithDataTestId } from './items/MenuItemWithDataTestId';
import { getMenuAnimation } from './MenuAnimation';

export type PropsContextConversationItem = {
  triggerId: string;
};

const ConversationListItemContextMenu = (props: PropsContextConversationItem) => {
  const { triggerId } = props;
  const isSearching = useIsSearching();

  const convoIdFromContext = useConvoIdFromContext();

  if (isSearching) {
    return null;
  }

  return (
    <SessionContextMenuContainer>
      <Menu id={triggerId} animation={getMenuAnimation()}>
        {/* Message request related actions */}
        <AcceptMsgRequestMenuItem />
        <DeclineMsgRequestMenuItem />
        <DeclineAndBlockMsgRequestMenuItem />
        {/* Generic actions */}
        <PinConversationMenuItem />
        <NotificationForConvoMenuItem />

        <BlockMenuItem />
        <CopyCommunityUrlMenuItem convoId={convoIdFromContext} />
        <CopyAccountIdMenuItem pubkey={convoIdFromContext} />
        {/* Read state actions */}
        <MarkAllReadMenuItem />
        <MarkConversationUnreadMenuItem />
        {/* Nickname actions */}
        <ChangeNicknameMenuItem />
        <ClearNicknameMenuItem />
        {/* Communities actions */}
        <BanMenuItem />
        <UnbanMenuItem />
        <InviteContactMenuItem />
        <DeleteMessagesMenuItem />
        <DeletePrivateConversationMenuItem />
        <LeaveGroupOrCommunityMenuItem />
        <ShowUserDetailsMenuItem />
      </Menu>
    </SessionContextMenuContainer>
  );
};

export const MemoConversationListItemContextMenu = ConversationListItemContextMenu;

export const PinConversationMenuItem = (): JSX.Element | null => {
  const conversationId = useConvoIdFromContext();
  const isMessagesSection = useSelector(getIsMessageSection);
  const isPrivateAndFriend = useIsPrivateAndFriend(conversationId);
  const isPrivate = useIsPrivate(conversationId);
  const isPinned = useIsPinned(conversationId);
  const isMessageRequest = useSelector(getIsMessageRequestOverlayShown);

  if (isMessagesSection && !isMessageRequest && (!isPrivate || (isPrivate && isPrivateAndFriend))) {
    const conversation = ConvoHub.use().get(conversationId);

    const togglePinConversation = () => {
      void conversation?.togglePinned();
    };

    const menuText = isPinned ? window.i18n('pinUnpin') : window.i18n('pin');
    return <ItemWithDataTestId onClick={togglePinConversation}>{menuText}</ItemWithDataTestId>;
  }
  return null;
};
