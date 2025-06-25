import { Menu } from 'react-contexify';

import { useConvoIdFromContext } from '../../contexts/ConvoIdContext';
import { useIsLegacyGroup, useIsPinned } from '../../hooks/useParamSelector';
import { ConvoHub } from '../../session/conversations';
import { useIsSearchingForType } from '../../state/selectors/search';
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
  DeletePrivateContactMenuItem,
  DeletePrivateConversationMenuItem,
  HideNoteToSelfMenuItem,
  InviteContactMenuItem,
  MarkAllReadMenuItem,
  MarkConversationUnreadMenuItem,
  NotificationForConvoMenuItem,
  ShowNoteToSelfMenuItem,
  ShowUserDetailsMenuItem,
  UnbanMenuItem,
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
import { useShowPinUnpin } from '../menuAndSettingsHooks/usePinUnpin';

export type PropsContextConversationItem = {
  triggerId: string;
};

const ConversationListItemContextMenu = (props: PropsContextConversationItem) => {
  const { triggerId } = props;
  const isSearching = useIsSearchingForType('global');

  const convoIdFromContext = useConvoIdFromContext();

  const legacyGroup = useIsLegacyGroup(convoIdFromContext);
  const isPinned = useIsPinned(convoIdFromContext);

  if (legacyGroup) {
    return (
      <SessionContextMenuContainer>
        <Menu id={triggerId} animation={getMenuAnimation()}>
          <DeleteDeprecatedLegacyGroupMenuItem />
          {isPinned ? <PinConversationMenuItem /> : null}
        </Menu>
      </SessionContextMenuContainer>
    );
  }

  if (isSearching) {
    // When we are searching, we can sometimes find conversations that should have a limited set of actions,
    // so here we have a whitelist of what can be done.

    return (
      <SessionContextMenuContainer>
        <Menu id={triggerId} animation={getMenuAnimation()}>
          <DeleteDeprecatedLegacyGroupMenuItem />
          <PinConversationMenuItem />
          <BlockMenuItem />
          <CopyCommunityUrlMenuItem convoId={convoIdFromContext} />
          <CopyAccountIdMenuItem pubkey={convoIdFromContext} />
          <DeleteMessagesMenuItem />
          <DeletePrivateConversationMenuItem />
          <LeaveCommunityMenuItem />
          <LeaveGroupMenuItem />
          <DeleteGroupMenuItem />
          <ShowNoteToSelfMenuItem />
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
        <InviteContactMenuItem />
        <DeleteMessagesMenuItem />
        <DeletePrivateConversationMenuItem />
        <DeletePrivateContactMenuItem />
        <HideNoteToSelfMenuItem />
        <ShowNoteToSelfMenuItem />
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
  const showPinUnpin = useShowPinUnpin(conversationId);
  const isPinned = useIsPinned(conversationId);

  if (!showPinUnpin) {
    return null;
  }
  const conversation = ConvoHub.use().get(conversationId);

  const togglePinConversation = () => {
    void conversation?.togglePinned();
  };

  const menuText = isPinned ? window.i18n('pinUnpin') : window.i18n('pin');
  return <ItemWithDataTestId onClick={togglePinConversation}>{menuText}</ItemWithDataTestId>;
};
