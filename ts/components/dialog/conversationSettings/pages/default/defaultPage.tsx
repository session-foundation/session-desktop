import { useIsGroupV2, useIsPublic, useWeAreAdmin } from '../../../../../hooks/useParamSelector';
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
  AddRemoveModeratorsButton,
  ConversationSettingsQAButtons,
  ClearAllMessagesButton,
  LeaveGroupPanelButton,
  DeleteGroupPanelButton,
  LeaveCommunityPanelButton,
  InviteContactsToGroupV2Button,
  InviteContactsToCommunityButton,
} from '../../conversationSettingsItems';

function AdminActions({ conversationId }: WithConvoId) {
  const isPublic = useIsPublic(conversationId);
  const isGroupV2 = useIsGroupV2(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);

  if ((!isPublic && !isGroupV2) || !weAreAdmin) {
    return null;
  }

  return (
    <>
      <SpacerSM />
      <PanelLabel>
        <Localizer token="adminSettings" />
      </PanelLabel>
      <PanelButtonGroup style={{ minWidth: '100%' }}>
        <InviteContactsToGroupV2Button conversationId={conversationId} />
        <UpdateGroupMembersButton conversationId={conversationId} />
        <UpdateDisappearingMessagesButton conversationId={conversationId} asAdmin={true} />
        <AddRemoveModeratorsButton conversationId={conversationId} />
        <ConversationSettingsQAButtons conversationId={conversationId} />
      </PanelButtonGroup>
    </>
  );
}

function DestructiveActions({ conversationId }: WithConvoId) {
  const isGroupV2 = useIsGroupV2(conversationId);
  const isPublic = useIsPublic(conversationId);

  return (
    <PanelButtonGroup>
      <ClearAllMessagesButton conversationId={conversationId} />
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

export function DefaultPage(props: WithConvoId) {
  if (!props?.conversationId) {
    return null;
  }
  const convoId = props.conversationId;
  return (
    <>
      <ConversationSettingsHeader conversationId={convoId} />

      <PanelButtonGroup>
        <PinUnpinButton conversationId={convoId} />
        <NotificationPanelButton convoId={convoId} />
        <UpdateGroupMembersButton conversationId={convoId} />
        <UpdateGroupNameButton conversationId={convoId} />
        <AttachmentsButton conversationId={convoId} />
        <UpdateDisappearingMessagesButton conversationId={convoId} asAdmin={false} />
        <InviteContactsToCommunityButton conversationId={convoId} />
      </PanelButtonGroup>

      {/* Below are "are admins" actions */}
      <AdminActions conversationId={props.conversationId} />

      {/* Below are "destructive" actions */}
      <SpacerSM />
      <DestructiveActions conversationId={props.conversationId} />
    </>
  );
}
