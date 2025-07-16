import { toast } from 'react-toastify';
import { SessionToast, SessionToastType } from '../../components/basic/SessionToast';
import { sectionActions, SectionType } from '../../state/ducks/section';
import { getPromotedGroupUpdateChangeStr } from '../../models/groupUpdate';

// if you push a toast manually with toast...() be sure to set the type attribute of the SessionToast component
export function pushToastError(id: string, description: string) {
  toast.error(<SessionToast description={description} type={SessionToastType.Error} />, {
    toastId: id,
    updateId: id,
  });
}

export function pushToastWarning(id: string, description: string, onToastClick?: () => void) {
  toast.warning(
    <SessionToast
      description={description}
      type={SessionToastType.Warning}
      onToastClick={onToastClick}
    />,
    {
      toastId: id,
      updateId: id,
    }
  );
}

export function pushToastInfo(id: string, description: string, onToastClick?: () => void) {
  toast.info(
    <SessionToast
      description={description}
      type={SessionToastType.Info}
      onToastClick={onToastClick}
    />,
    { toastId: id, updateId: id }
  );
}

export function pushToastSuccess(id: string, description: string) {
  toast.success(<SessionToast description={description} type={SessionToastType.Success} />, {
    toastId: id,
    updateId: id,
  });
}

export function pushLoadAttachmentFailure(message?: string) {
  if (message) {
    pushToastError(
      'unableToLoadAttachment',
      `${window.i18n.stripped('attachmentsErrorLoad')} ${message}`
    );
  } else {
    pushToastError('unableToLoadAttachment', window.i18n.stripped('attachmentsErrorLoad'));
  }
}

// TODOLATER pushToast functions should take I18nArgs and then run strip in the function itself.

export function pushFileSizeErrorAsByte() {
  pushToastError('fileSizeWarning', window.i18n.stripped('attachmentsErrorSize'));
}

export function pushMultipleNonImageError() {
  pushToastError('attachmentsErrorTypes', window.i18n.stripped('attachmentsErrorTypes'));
}

export function pushCannotMixError() {
  pushToastError('attachmentsErrorTypes', window.i18n.stripped('attachmentsErrorTypes'));
}

export function pushMaximumAttachmentsError() {
  pushToastError('attachmentsErrorNumber', window.i18n.stripped('attachmentsErrorNumber'));
}

export function pushCopiedToClipBoard() {
  pushToastInfo('copiedToClipboard', window.i18n.stripped('copied'));
}

export function pushRestartNeeded() {
  pushToastInfo('restartNeeded', window.i18n.stripped('settingsRestartDescription'));
}

export function pushAlreadyMemberOpenGroup() {
  pushToastInfo('publicChatExists', window.i18n.stripped('communityJoinedAlready'));
}

export function pushUserBanSuccess() {
  pushToastSuccess('userBanned', window.i18n.stripped('banUserBanned'));
}

export function pushUserBanFailure() {
  pushToastError('userBanFailed', window.i18n.stripped('banErrorFailed'));
}

export function pushUserUnbanSuccess() {
  pushToastSuccess('userUnbanned', window.i18n.stripped('banUnbanUserUnbanned'));
}

export function pushUserUnbanFailure() {
  pushToastError('userUnbanFailed', window.i18n.stripped('banUnbanErrorFailed'));
}

export function pushMessageDeleteForbidden() {
  pushToastError(
    'messageDeletionForbidden',
    window.i18n.stripped('deleteAfterMessageDeletionStandardisationMessageDeletionForbidden')
  );
}

export function pushUnableToCall() {
  pushToastError('unableToCall', window.i18n.stripped('callsCannotStart'));
}

export function pushedMissedCall(userName: string) {
  pushToastInfo('missedCall', window.i18n.stripped('callsMissedCallFrom', { name: userName }));
}

const openPermissionsSettings = () => {
  window.inboxStore?.dispatch(sectionActions.showLeftPaneSection(SectionType.Settings));
  window.inboxStore?.dispatch(sectionActions.showSettingsSection('permissions'));
};

export function pushedMissedCallCauseOfPermission(conversationName: string) {
  const id = 'missedCallPermission';
  toast.info(
    <SessionToast
      description={window.i18n.stripped('callsYouMissedCallPermissions', {
        name: conversationName,
      })}
      type={SessionToastType.Info}
      onToastClick={openPermissionsSettings}
    />,
    { toastId: id, updateId: id, autoClose: 10000 }
  );
}

export function pushVideoCallPermissionNeeded() {
  pushToastInfo(
    'videoCallPermissionNeeded',
    window.i18n.stripped('callsPermissionsRequiredDescription'),
    openPermissionsSettings
  );
}

export function pushAudioPermissionNeeded() {
  pushToastInfo(
    'audioPermissionNeeded',
    window.i18n.stripped('permissionsMicrophoneAccessRequiredDesktop'),
    openPermissionsSettings
  );
}

export function pushOriginalNotFound() {
  pushToastError('messageErrorOriginal', window.i18n.stripped('messageErrorOriginal'));
}

export function pushTooManyMembers() {
  pushToastError('groupAddMemberMaximum', window.i18n.stripped('groupAddMemberMaximum'));
}

export function pushMessageRequestPending() {
  pushToastInfo('messageRequestPending', window.i18n.stripped('messageRequestPending'));
}

export function pushUnblockToSend() {
  pushToastInfo('unblockToSend', window.i18n.stripped('blockBlockedDescription'));
}

export function pushYouLeftTheGroup() {
  pushToastError('youLeftTheGroup', window.i18n.stripped('groupMemberYouLeft'));
}

export function someDeletionsFailed(count: number) {
  pushToastWarning('deletionError', window.i18n.stripped('deleteMessageFailed', { count }));
}

export function pushDeleted(count: number) {
  pushToastSuccess('deleted', window.i18n.stripped('deleteMessageDeleted', { count }));
}

export function pushCannotRemoveGroupAdmin() {
  pushToastWarning('adminCannotBeRemoved', window.i18n.stripped('adminCannotBeRemoved'));
}

export function pushFailedToAddAsModerator() {
  pushToastWarning('adminPromotionFailed', window.i18n.stripped('adminPromotionFailed'));
}

export function pushFailedToRemoveFromModerator(names: Array<string>) {
  let localizedString: string = '';
  switch (names.length) {
    case 0:
      throw new Error('pushFailedToRemoveFromModerator invalid case error');
    case 1:
      localizedString = window.i18n.stripped('adminRemoveFailed', {
        name: names[0],
      });
      break;
    case 2:
      localizedString = window.i18n.stripped('adminRemoveFailedOther', {
        name: names[0],
        other_name: names[1],
      });
      break;
    default:
      localizedString = window.i18n.stripped('adminRemoveFailedMultiple', {
        name: names[0],
        count: names.length - 1,
      });
      break;
  }
  pushToastWarning('adminRemoveFailed', localizedString);
}

export function pushUserAddedToModerators(userNames: Array<string>) {
  const args = getPromotedGroupUpdateChangeStr(userNames);
  pushToastSuccess('adminPromotedToAdmin', window.i18n.stripped(args.token, args.args));
}

export function pushUserRemovedFromModerators(names: Array<string>) {
  let localizedString: string = '';
  switch (names.length) {
    case 0:
      throw new Error('pushUserRemovedFromModerators invalid case error');
    case 1:
      localizedString = window.i18n.stripped('adminRemovedUser', {
        name: names[0],
      });
      break;
    case 2:
      localizedString = window.i18n.stripped('adminRemovedUserOther', {
        name: names[0],
        other_name: names[1],
      });
      break;
    default:
      localizedString = window.i18n.stripped('adminRemovedUserMultiple', {
        name: names[0],
        count: names.length - 1,
      });
      break;
  }

  pushToastSuccess('adminRemovedUser', localizedString);
}

export function pushInvalidPubKey() {
  pushToastSuccess('accountIdErrorInvalid', window.i18n.stripped('accountIdErrorInvalid'));
}

export function pushNoCameraFound() {
  pushToastWarning('noCameraFound', window.i18n.stripped('cameraErrorNotFound'));
}

export function pushNoAudioInputFound() {
  pushToastWarning('noAudioInputFound', window.i18n.stripped('audioNoInput'));
}

export function pushNoAudioOutputFound() {
  pushToastWarning('noAudioOutputFound', window.i18n.stripped('audioNoOutput'));
}

export function pushNoMediaUntilApproved() {
  pushToastError('noMediaUntilApproved', window.i18n.stripped('messageRequestPendingDescription'));
}

export function pushRateLimitHitReactions() {
  pushToastInfo('reactRateLimit', window?.i18n?.('emojiReactsCoolDown'));
}
