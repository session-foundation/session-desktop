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
import { useShowAttachments } from '../../../../menuAndSettingsHooks/useShowAttachments';
import { ConversationSettingsHeader } from '../../conversationSettingsHeader';
import {
  PinUnpinButton,
  NotificationPanelButton,
  UpdateGroupMembersButton,
  AttachmentsButton,
  UpdateDisappearingMessagesButton,
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
  ShowNoteToSelfButton,
} from '../../conversationSettingsItems';

function AdminSettingsTitle() {
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
      <AdminSettingsTitle />
      <PanelButtonGroup>
        <InviteContactsToGroupV2Button conversationId={conversationId} />
        <UpdateGroupMembersButton conversationId={conversationId} asAdmin={true} />
        <UpdateDisappearingMessagesButton conversationId={conversationId} asAdmin={true} />
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
      <AdminSettingsTitle />
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
      <HideNoteToSelfButton conversationId={conversationId} />
      <ClearAllMessagesButton conversationId={conversationId} />
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

  return (
    <>
      <ConversationSettingsHeader conversationId={conversationId} />

      <PanelButtonGroup>
        <CopyAccountIdButton conversationId={conversationId} />
        <UpdateDisappearingMessagesButton conversationId={conversationId} asAdmin={false} />
        <PinUnpinButton conversationId={conversationId} />
        <NotificationPanelButton convoId={conversationId} />
        <AttachmentsButton conversationId={conversationId} />
        <ShowNoteToSelfButton conversationId={conversationId} />
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
  return (
    <>
      <ConversationSettingsHeader conversationId={conversationId} />

      <PanelButtonGroup>
        <CopyCommunityUrlButton conversationId={conversationId} />
        <PinUnpinButton conversationId={conversationId} />
        <NotificationPanelButton convoId={conversationId} />
        <InviteContactsToCommunityButton conversationId={conversationId} />
        <AttachmentsButton conversationId={conversationId} />
      </PanelButtonGroup>

      {/* Below are "admins" actions */}
      <CommunityAdminActions conversationId={conversationId} />

      {/* Below are "destructive" actions */}
      <SpacerSM />
      <DestructiveActions conversationId={conversationId} />
    </>
  );
}

function DefaultPageForGroupV2({ conversationId }: WithConvoId) {
  /**
   * Sometimes this menu is empty.
   * When it is, there is still the padding of the PanelButtonGroup that is visible, and we want to avoid this.
   * AttachmentsButton is *almost* always shown, but when it isn't the conditions mean that the whole menu is empty.
   * So we can just filter based on if AttachmentsButton is shown of not.
   */
  const showAttachmentsCb = useShowAttachments({ conversationId });
  if (!conversationId) {
    return null;
  }
  return (
    <>
      <ConversationSettingsHeader conversationId={conversationId} />

      {showAttachmentsCb ? (
        <PanelButtonGroup>
          <UpdateDisappearingMessagesButton conversationId={conversationId} asAdmin={false} />
          <PinUnpinButton conversationId={conversationId} />
          <NotificationPanelButton convoId={conversationId} />
          <UpdateGroupMembersButton conversationId={conversationId} asAdmin={false} />
          <AttachmentsButton conversationId={conversationId} />
        </PanelButtonGroup>
      ) : null}

      {/* Below are "admins" actions */}
      <GroupV2AdminActions conversationId={conversationId} />

      {/* Below are "destructive" actions */}
      <SpacerSM />
      <DestructiveActions conversationId={conversationId} />
    </>
  );
}

export function DefaultConversationSettingsPage(props: WithConvoId) {
  const isPrivate = useIsPrivate(props?.conversationId);
  const isPublic = useIsPublic(props?.conversationId);
  const isGroupV2 = useIsGroupV2(props?.conversationId);

  if (!props?.conversationId) {
    return null;
  }

  if (isPrivate) {
    return <DefaultPageForPrivate conversationId={props.conversationId} />;
  }

  if (isPublic) {
    return <DefaultPageForCommunities conversationId={props.conversationId} />;
  }

  if (!isGroupV2) {
    return null;
  }

  return <DefaultPageForGroupV2 conversationId={props.conversationId} />;
}
