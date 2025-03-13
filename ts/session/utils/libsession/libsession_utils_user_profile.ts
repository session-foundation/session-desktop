import { isEmpty } from 'lodash';
import { UserUtils } from '..';
import { SettingsKey } from '../../../data/settings-key';
import { CONVERSATION_PRIORITIES } from '../../../models/types';
import { stringify } from '../../../types/sqlSharedTypes';
import { Storage } from '../../../util/storage';
import { UserConfigWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { ConvoHub } from '../../conversations';
import { fromHexToArray } from '../String';

async function insertUserProfileIntoWrapper(convoId: string) {
  if (!SessionUtilUserProfile.isUserProfileToStoreInWrapper(convoId)) {
    return null;
  }
  const us = UserUtils.getOurPubKeyStrFromCache();
  const ourConvo = ConvoHub.use().get(us);

  if (!ourConvo) {
    throw new Error('insertUserProfileIntoWrapper needs a ourConvo to exist');
  }

  const dbName = ourConvo.getRealSessionUsername() || '';
  const dbProfileUrl = ourConvo.getAvatarPointer() || '';
  const dbProfileKey = fromHexToArray(ourConvo.getProfileKey() || '');
  const priority = ourConvo.get('priority') || CONVERSATION_PRIORITIES.default; // this has to be a direct call to .get() and not getPriority()

  const areBlindedMsgRequestEnabled = !!Storage.get(SettingsKey.hasBlindedMsgRequestsEnabled);

  const expirySeconds = ourConvo.getExpireTimer() || 0;
  window.log.debug(
    `inserting into userprofile wrapper: username:"${dbName}", priority:${priority} image:${JSON.stringify(
      { url: dbProfileUrl, key: stringify(dbProfileKey) }
    )}, settings: ${JSON.stringify({ areBlindedMsgRequestEnabled, expirySeconds })}`
  );

  // we don't want to throw if somehow our display name in the DB is too long here, so we use the truncated version.
  await UserConfigWrapperActions.setNameTruncated(dbName);
  await UserConfigWrapperActions.setPriority(priority);
  if (dbProfileUrl && !isEmpty(dbProfileKey) && dbProfileKey.length === 32) {
    await UserConfigWrapperActions.setProfilePic({ key: dbProfileKey, url: dbProfileUrl });
  } else {
    await UserConfigWrapperActions.setProfilePic({ key: null, url: null });
  }

  await UserConfigWrapperActions.setEnableBlindedMsgRequest(areBlindedMsgRequestEnabled);
  await UserConfigWrapperActions.setNoteToSelfExpiry(expirySeconds);

  // returned for testing purposes only
  return {
    id: convoId,
    name: dbName,
    priority,
    avatarPointer: dbProfileUrl,
    expirySeconds,
  };
}

function isUserProfileToStoreInWrapper(convoId: string) {
  try {
    const us = UserUtils.getOurPubKeyStrFromCache();
    return convoId === us;
  } catch (e) {
    return false;
  }
}

export const SessionUtilUserProfile = {
  insertUserProfileIntoWrapper,
  isUserProfileToStoreInWrapper,
};
