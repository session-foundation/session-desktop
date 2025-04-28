import {
  useIsGroupV2,
  useIsPrivate,
  useIsPublic,
  useWeAreAdmin,
} from '../../../../../hooks/useParamSelector';
import type { WithConvoId } from '../../../../../session/types/with';
import { Localizer } from '../../../../basic/Localizer';
import { SpacerSM } from '../../../../basic/Text';
import { PanelButtonGroup } from '../../../../buttons';
import { PanelLabel } from '../../../../buttons/PanelButton';
import { ConversationSettingsHeader } from '../../conversationSettingsHeader';
import {
  PinUnpinButton,
  NotificationPanelButton,
  UpdateGroupMembersButton,
  UpdateGroupNameButton,
  AttachmentsButton,
  UpdateDisappearingMessagesButton,
  ConversationSettingsQAButtons,
  ClearAllMessagesButton,
  LeaveGroupPanelButton,
  DeleteGroupPanelButton,
  LeaveCommunityPanelButton,
  InviteContactsToGroupV2Button,
  InviteContactsToCommunityButton,
  CopyAccountIdButton,
  BlockUnblockButton,
  DeletePrivateContactButton,
  DeletePrivateConversationButton,
  HideNoteToSelfButton,
  CopyCommunityUrlButton,
  BanFromCommunityButton,
  UnbanFromCommunityButton,
  AddAdminCommunityButton,
  RemoveAdminCommunityButton,
} from '../../conversationSettingsItems';

function GroupSettingsTitle() {
  return (
    <PanelLabel>
      <Localizer token="adminSettings" />
    </PanelLabel>
  );
}

function GroupV2AdminActions({ conversationId }: WithConvoId) {
  const isPublic = useIsPublic(conversationId);
  const isGroupV2 = useIsGroupV2(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);

  if ((!isPublic && !isGroupV2) || !weAreAdmin) {
    return null;
  }

  return (
    <>
      <SpacerSM />
      <GroupSettingsTitle />
      <PanelButtonGroup>
        <InviteContactsToGroupV2Button conversationId={conversationId} />
        <UpdateGroupMembersButton conversationId={conversationId} />
        <UpdateDisappearingMessagesButton conversationId={conversationId} asAdmin={true} />
        TODO : add back admins add for group v2
        <ConversationSettingsQAButtons conversationId={conversationId} />
      </PanelButtonGroup>
    </>
  );
}
function CommunityAdminActions({ conversationId }: WithConvoId) {
  const isPublic = useIsPublic(conversationId);
  const isGroupV2 = useIsGroupV2(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);

  if ((!isPublic && !isGroupV2) || !weAreAdmin) {
    return null;
  }

  return (
    <>
      <SpacerSM />
      <GroupSettingsTitle />
      <PanelButtonGroup>
        <BanFromCommunityButton conversationId={conversationId} />
        <UnbanFromCommunityButton conversationId={conversationId} />
        <AddAdminCommunityButton conversationId={conversationId} />
        <RemoveAdminCommunityButton conversationId={conversationId} />
      </PanelButtonGroup>
    </>
  );
}

function DestructiveActions({ conversationId }: WithConvoId) {
  const isGroupV2 = useIsGroupV2(conversationId);
  const isPublic = useIsPublic(conversationId);

  return (
    <PanelButtonGroup>
      <BlockUnblockButton conversationId={conversationId} />
      <ClearAllMessagesButton conversationId={conversationId} />
      <HideNoteToSelfButton conversationId={conversationId} />
      <DeletePrivateConversationButton conversationId={conversationId} />
      <DeletePrivateContactButton conversationId={conversationId} />
      {(isGroupV2 || isPublic) && (
        <>
          <LeaveGroupPanelButton conversationId={conversationId} />
          <DeleteGroupPanelButton conversationId={conversationId} />
          <LeaveCommunityPanelButton conversationId={conversationId} />
        </>
      )}
    </PanelButtonGroup>
  );
}

function DefaultPageForPrivate({ conversationId }: WithConvoId) {
  if (!conversationId) {
    return null;
  }
  const convoId = conversationId;
  return (
    <>
      <ConversationSettingsHeader conversationId={convoId} />

      <PanelButtonGroup>
        <CopyAccountIdButton conversationId={convoId} />
        <UpdateDisappearingMessagesButton conversationId={convoId} asAdmin={false} />
        <PinUnpinButton conversationId={convoId} />
        <NotificationPanelButton convoId={convoId} />
        <AttachmentsButton conversationId={convoId} />
      </PanelButtonGroup>

      {/* Below are "destructive" actions */}
      <SpacerSM />
      <DestructiveActions conversationId={conversationId} />
    </>
  );
}

function DefaultPageForCommunities({ conversationId }: WithConvoId) {
  if (!conversationId) {
    return null;
  }
  const convoId = conversationId;
  return (
    <>
      <ConversationSettingsHeader conversationId={convoId} />

      <PanelButtonGroup>
        <CopyCommunityUrlButton conversationId={convoId} />
        <PinUnpinButton conversationId={convoId} />
        <NotificationPanelButton convoId={convoId} />
        <UpdateGroupMembersButton conversationId={convoId} />
        <UpdateGroupNameButton conversationId={convoId} />
        <InviteContactsToCommunityButton conversationId={convoId} />
        <AttachmentsButton conversationId={convoId} />
      </PanelButtonGroup>

      {/* Below are "admins" actions */}
      <CommunityAdminActions conversationId={convoId} />

      {/* Below are "destructive" actions */}
      <SpacerSM />
      <DestructiveActions conversationId={conversationId} />
    </>
  );
}

export function DefaultPage(props: WithConvoId) {
  const isPrivate = useIsPrivate(props?.conversationId);
  const isPublic = useIsPublic(props?.conversationId);
  const isGroupV2 = useIsGroupV2(props?.conversationId);

  if (!props?.conversationId) {
    return null;
  }
  const convoId = props.conversationId;

  if (isPrivate) {
    return <DefaultPageForPrivate conversationId={convoId} />;
  }

  if (isPublic) {
    return <DefaultPageForCommunities conversationId={convoId} />;
  }

  if (!isGroupV2) {
    return null;
  }

  return (
    <>
      <ConversationSettingsHeader conversationId={convoId} />

      <PanelButtonGroup>
        <CopyCommunityUrlButton conversationId={convoId} />
        <PinUnpinButton conversationId={convoId} />
        <NotificationPanelButton convoId={convoId} />
        <UpdateDisappearingMessagesButton conversationId={convoId} asAdmin={false} />
        <UpdateGroupMembersButton conversationId={convoId} />
        <UpdateGroupNameButton conversationId={convoId} />
        <InviteContactsToCommunityButton conversationId={convoId} />
        <AttachmentsButton conversationId={convoId} />
      </PanelButtonGroup>

      {/* Below are "admins" actions */}
      <GroupV2AdminActions conversationId={props.conversationId} />

      {/* Below are "destructive" actions */}
      <SpacerSM />
      <DestructiveActions conversationId={props.conversationId} />
    </>
  );
}
