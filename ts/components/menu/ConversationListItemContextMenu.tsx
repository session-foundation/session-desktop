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
} from './Menu';
import { CopyCommunityUrlMenuItem } from './items/CopyCommunityUrl/CopyCommunityUrlMenuItem';
import { CopyAccountIdMenuItem } from './items/CopyAccountId/CopyAccountIdMenuItem';
import { Menu, MenuItem } from './items/MenuItem';
import { LeaveCommunityMenuItem } from './items/LeaveCommunity/LeaveCommunityMenuItem';
import { LeaveGroupMenuItem } from './items/LeaveAndDeleteGroup/LeaveGroupMenuItem';
import {
  DeleteDeprecatedLegacyGroupMenuItem,
  DeleteDestroyedOrKickedGroupMenuItem,
  DeleteGroupMenuItem,
} from './items/LeaveAndDeleteGroup/DeleteGroupMenuItem';
import { tr } from '../../localization/localeTools';
import { useTogglePinConversationHandler } from '../menuAndSettingsHooks/UseTogglePinConversationHandler';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

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
        <Menu id={triggerId}>
          {isPinned ? <PinConversationMenuItem /> : null}
          {/* Danger actions */}
          <DeleteDeprecatedLegacyGroupMenuItem />
        </Menu>
      </SessionContextMenuContainer>
    );
  }

  if (isSearching) {
    // When we are searching, we can sometimes find conversations that should have a limited set of actions,
    // so here we have a whitelist of what can be done.

    return (
      <SessionContextMenuContainer>
        <Menu id={triggerId}>
          <PinConversationMenuItem />
          <CopyCommunityUrlMenuItem convoId={convoIdFromContext} />
          <CopyAccountIdMenuItem pubkey={convoIdFromContext} messageId={undefined} />
          <ShowNoteToSelfMenuItem />
          {/* Danger actions */}
          <BlockMenuItem />
          <DeleteDeprecatedLegacyGroupMenuItem />
          <DeleteDestroyedOrKickedGroupMenuItem />
          <LeaveGroupMenuItem />
          <DeletePrivateConversationMenuItem />
          <LeaveCommunityMenuItem />
          <DeleteGroupMenuItem />
          <DeleteMessagesMenuItem />
        </Menu>
      </SessionContextMenuContainer>
    );
  }

  return (
    <SessionContextMenuContainer>
      <Menu id={triggerId}>
        {/* Note: the order here is on purpose */}

        {/* Generic actions */}
        <PinConversationMenuItem />
        {/* Message request related actions */}
        <AcceptMsgRequestMenuItem />
        <CopyCommunityUrlMenuItem convoId={convoIdFromContext} />
        <CopyAccountIdMenuItem pubkey={convoIdFromContext} messageId={undefined} />
        <NotificationForConvoMenuItem />
        {/* Read state actions */}
        <MarkAllReadMenuItem />
        <MarkConversationUnreadMenuItem />
        {/* Nickname actions */}
        <ChangeNicknameMenuItem />
        <ShowUserProfileMenuItem />
        <HideNoteToSelfMenuItem />
        <ShowNoteToSelfMenuItem />
        {/* Communities actions */}
        <InviteContactMenuItem />
        {/* Danger actions */}

        <BlockMenuItem />
        <DeclineMsgRequestMenuItem />
        <DeclineAndBlockMsgRequestMenuItem />
        <DeletePrivateConversationMenuItem />
        <DeletePrivateContactMenuItem />
        <LeaveCommunityMenuItem />
        <LeaveGroupMenuItem />
        <DeleteGroupMenuItem />
        <DeleteDestroyedOrKickedGroupMenuItem />
        <BanMenuItem />
        <UnbanMenuItem />
        <DeleteMessagesMenuItem />
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
  return (
    <MenuItem
      onClick={togglePinConversation}
      iconType={isPinned ? LUCIDE_ICONS_UNICODE.PIN_OFF : LUCIDE_ICONS_UNICODE.PIN}
      isDangerAction={false}
    >
      {menuText}
    </MenuItem>
  );
};
