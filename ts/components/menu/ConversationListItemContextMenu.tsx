import { Menu } from 'react-contexify';

import type { JSX } from 'react';
import { useConvoIdFromContext } from '../../contexts/ConvoIdContext';
import { useIsLegacyGroup, useIsPinned } from '../../hooks/useParamSelector';
import { useIsSearchingForType } from '../../state/selectors/search';
import { SessionContextMenuContainer } from '../SessionContextMenuContainer';
import {
  AcceptMsgRequestMenuItem,
  BanMenuItem,
  BlockMenuItem,
  ChangeNicknameMenuItem,
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
  ShowUserProfileMenuItem,
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
import { tr } from '../../localization/localeTools';
import { useTogglePinConversationHandler } from '../menuAndSettingsHooks/UseTogglePinConversationHandler';

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
        {/* Communities actions */}
        <BanMenuItem />
        <UnbanMenuItem />
        <ServerBanMenuItem />
        <ServerUnbanMenuItem />
        <InviteContactMenuItem />
        <DeleteMessagesMenuItem />
        <DeletePrivateConversationMenuItem />
        <DeletePrivateContactMenuItem />
        <HideNoteToSelfMenuItem />
        <ShowNoteToSelfMenuItem />
        <LeaveCommunityMenuItem />
        <LeaveGroupMenuItem />
        <DeleteGroupMenuItem />
        <ShowUserProfileMenuItem />
      </Menu>
    </SessionContextMenuContainer>
  );
};

export const MemoConversationListItemContextMenu = ConversationListItemContextMenu;

export const PinConversationMenuItem = (): JSX.Element | null => {
  const conversationId = useConvoIdFromContext();
  const isPinned = useIsPinned(conversationId);
  const togglePinConversation = useTogglePinConversationHandler(conversationId);

  if (!togglePinConversation) {
    return null;
  }

  const menuText = tr(isPinned ? 'pinUnpin' : 'pin');
  return <ItemWithDataTestId onClick={togglePinConversation}>{menuText}</ItemWithDataTestId>;
};
