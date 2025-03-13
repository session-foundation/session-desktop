import { Menu } from 'react-contexify';

import { useSelector } from 'react-redux';
import { useConvoIdFromContext } from '../../contexts/ConvoIdContext';
import { useIsPinned, useIsPrivate, useIsPrivateAndFriend } from '../../hooks/useParamSelector';
import { ConvoHub } from '../../session/conversations';
import {
  getIsMessageSection,
  useIsMessageRequestOverlayShown,
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
  MarkAllReadMenuItem,
  MarkConversationUnreadMenuItem,
  NotificationForConvoMenuItem,
  ShowUserDetailsMenuItem,
  UnbanMenuItem,
  ServerBanMenuItem,
  ServerUnbanMenuItem,
} from './Menu';
import { CopyCommunityUrlMenuItem } from './items/CopyCommunityUrl/CopyCommunityUrlMenuItem';
import { CopyAccountIdMenuItem } from './items/CopyAccountId/CopyAccountIdMenuItem';
import { ItemWithDataTestId } from './items/MenuItemWithDataTestId';
import { getMenuAnimation } from './MenuAnimation';
import { LeaveCommunityMenuItem } from './items/LeaveCommunity/LeaveCommunityMenuItem';
import { LeaveGroupMenuItem } from './items/LeaveAndDeleteGroup/LeaveGroupMenuItem';
import {
  DeleteDeprecatedLegacyGroupMenuItem,
  DeleteGroupMenuItem,
} from './items/LeaveAndDeleteGroup/DeleteGroupMenuItem';
import { useDisableLegacyGroupDeprecatedActions } from '../../hooks/useRefreshReleasedFeaturesTimestamp';

export type PropsContextConversationItem = {
  triggerId: string;
};

const ConversationListItemContextMenu = (props: PropsContextConversationItem) => {
  const { triggerId } = props;
  const isSearching = useIsSearching();

  const convoIdFromContext = useConvoIdFromContext();

  const disabledLegacyGroup = useDisableLegacyGroupDeprecatedActions(convoIdFromContext);
  const isPinned = useIsPinned(convoIdFromContext);

  if (isSearching) {
    return null;
  }

  if (disabledLegacyGroup) {
    return (
      <SessionContextMenuContainer>
        <Menu id={triggerId} animation={getMenuAnimation()}>
          <DeleteDeprecatedLegacyGroupMenuItem />
          {isPinned ? <PinConversationMenuItem /> : null}
        </Menu>
      </SessionContextMenuContainer>
    );
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
        <ServerBanMenuItem />
        <ServerUnbanMenuItem />
        <InviteContactMenuItem />
        <DeleteMessagesMenuItem />
        <DeletePrivateConversationMenuItem />
        <LeaveCommunityMenuItem />
        <LeaveGroupMenuItem />
        <DeleteGroupMenuItem />
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
  const isMessageRequest = useIsMessageRequestOverlayShown();

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
