import { toast } from 'react-toastify';
import { SessionToast, SessionToastType } from '../../components/basic/SessionToast';
import { sectionActions, SectionType } from '../../state/ducks/section';
import { getPromotedGroupUpdateChangeStr } from '../../models/groupUpdate';
import { strippedWithObj, tStripped } from '../../localization/localeTools';

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
    pushToastError('unableToLoadAttachment', `${tStripped('attachmentsErrorLoad')} ${message}`);
  } else {
    pushToastError('unableToLoadAttachment', tStripped('attachmentsErrorLoad'));
  }
}

// TODOLATER pushToast functions should take I18nArgs and then run strip in the function itself.

export function pushFileSizeErrorAsByte() {
  pushToastError('fileSizeWarning', tStripped('attachmentsErrorSize'));
}

export function pushMultipleNonImageError() {
  pushToastError('attachmentsErrorTypes', tStripped('attachmentsErrorTypes'));
}

export function pushCannotMixError() {
  pushToastError('attachmentsErrorTypes', tStripped('attachmentsErrorTypes'));
}

export function pushMaximumAttachmentsError() {
  pushToastError('attachmentsErrorNumber', tStripped('attachmentsErrorNumber'));
}

export function pushCopiedToClipBoard() {
  pushToastInfo('copiedToClipboard', tStripped('copied'));
}

export function pushRestartNeeded() {
  pushToastInfo('restartNeeded', tStripped('settingsRestartDescription'));
}

export function pushAlreadyMemberOpenGroup() {
  pushToastInfo('publicChatExists', tStripped('communityJoinedAlready'));
}

export function pushUserBanSuccess() {
  pushToastSuccess('userBanned', tStripped('banUserBanned'));
}

export function pushUserBanFailure() {
  pushToastError('userBanFailed', tStripped('banErrorFailed'));
}

export function pushUserUnbanSuccess() {
  pushToastSuccess('userUnbanned', tStripped('banUnbanUserUnbanned'));
}

export function pushUserUnbanFailure() {
  pushToastError('userUnbanFailed', tStripped('banUnbanErrorFailed'));
}

export function pushMessageDeleteForbidden() {
  pushToastError(
    'messageDeletionForbidden',
    tStripped('deleteAfterMessageDeletionStandardisationMessageDeletionForbidden')
  );
}

export function pushUnableToCall() {
  pushToastError('unableToCall', tStripped('callsCannotStart'));
}

export function pushedMissedCall(userName: string) {
  pushToastInfo('missedCall', tStripped('callsMissedCallFrom', { name: userName }));
}

const openPermissionsSettings = () => {
  window.inboxStore?.dispatch(sectionActions.showLeftPaneSection(SectionType.Settings));
  window.inboxStore?.dispatch(sectionActions.showSettingsSection('permissions'));
};

export function pushedMissedCallCauseOfPermission(conversationName: string) {
  const id = 'missedCallPermission';
  toast.info(
    <SessionToast
      description={tStripped('callsYouMissedCallPermissions', {
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
    tStripped('callsPermissionsRequiredDescription'),
    openPermissionsSettings
  );
}

export function pushAudioPermissionNeeded() {
  pushToastInfo(
    'audioPermissionNeeded',
    tStripped('permissionsMicrophoneAccessRequiredDesktop'),
    openPermissionsSettings
  );
}

export function pushOriginalNotFound() {
  pushToastError('messageErrorOriginal', tStripped('messageErrorOriginal'));
}

export function pushTooManyMembers() {
  pushToastError('groupAddMemberMaximum', tStripped('groupAddMemberMaximum'));
}

export function pushMessageRequestPending() {
  pushToastInfo('messageRequestPending', tStripped('messageRequestPending'));
}

export function pushUnblockToSend() {
  pushToastInfo('unblockToSend', tStripped('blockBlockedDescription'));
}

export function pushYouLeftTheGroup() {
  pushToastError('youLeftTheGroup', tStripped('groupMemberYouLeft'));
}

export function someDeletionsFailed(count: number) {
  pushToastWarning('deletionError', tStripped('deleteMessageFailed', { count }));
}

export function pushDeleted(count: number) {
  pushToastSuccess('deleted', tStripped('deleteMessageDeleted', { count }));
}

export function pushCannotRemoveGroupAdmin() {
  pushToastWarning('adminCannotBeRemoved', tStripped('adminCannotBeRemoved'));
}

export function pushFailedToAddAsModerator() {
  pushToastWarning('adminPromotionFailed', tStripped('adminPromotionFailed'));
}

export function pushFailedToRemoveFromModerator(names: Array<string>) {
  let localizedString: string = '';
  switch (names.length) {
    case 0:
      throw new Error('pushFailedToRemoveFromModerator invalid case error');
    case 1:
      localizedString = tStripped('adminRemoveFailed', {
        name: names[0],
      });
      break;
    case 2:
      localizedString = tStripped('adminRemoveFailedOther', {
        name: names[0],
        other_name: names[1],
      });
      break;
    default:
      localizedString = tStripped('adminRemoveFailedMultiple', {
        name: names[0],
        count: names.length - 1,
      });
      break;
  }
  pushToastWarning('adminRemoveFailed', localizedString);
}

export function pushUserAddedToModerators(userNames: Array<string>) {
  const opts = getPromotedGroupUpdateChangeStr(userNames);
  pushToastSuccess('adminPromotedToAdmin', strippedWithObj(opts));
}

export function pushUserRemovedFromModerators(names: Array<string>) {
  let localizedString: string = '';
  switch (names.length) {
    case 0:
      throw new Error('pushUserRemovedFromModerators invalid case error');
    case 1:
      localizedString = tStripped('adminRemovedUser', {
        name: names[0],
      });
      break;
    case 2:
      localizedString = tStripped('adminRemovedUserOther', {
        name: names[0],
        other_name: names[1],
      });
      break;
    default:
      localizedString = tStripped('adminRemovedUserMultiple', {
        name: names[0],
        count: names.length - 1,
      });
      break;
  }

  pushToastSuccess('adminRemovedUser', localizedString);
}

export function pushInvalidPubKey() {
  pushToastSuccess('accountIdErrorInvalid', tStripped('accountIdErrorInvalid'));
}

export function pushNoCameraFound() {
  pushToastWarning('noCameraFound', tStripped('cameraErrorNotFound'));
}

export function pushNoAudioInputFound() {
  pushToastWarning('noAudioInputFound', tStripped('audioNoInput'));
}

export function pushNoAudioOutputFound() {
  pushToastWarning('noAudioOutputFound', tStripped('audioNoOutput'));
}

export function pushNoMediaUntilApproved() {
  pushToastError('noMediaUntilApproved', tStripped('messageRequestPendingDescription'));
}

export function pushRateLimitHitReactions() {
  pushToastInfo('reactRateLimit', tStripped('emojiReactsCoolDown'));
}
