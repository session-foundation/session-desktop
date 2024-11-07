import { isEmpty } from 'lodash';
import { UserUtils } from '..';
import { SettingsKey } from '../../../data/settings-key';
import { Storage } from '../../../util/storage';
import { UserConfigWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { getConversationController } from '../../conversations';
import { fromHexToArray } from '../String';
import { CONVERSATION_PRIORITIES } from '../../../models/types';

async function insertUserProfileIntoWrapper(convoId: string) {
  if (!SessionUtilUserProfile.isUserProfileToStoreInWrapper(convoId)) {
    return null;
  }
  const us = UserUtils.getOurPubKeyStrFromCache();
  const ourConvo = getConversationController().get(us);

  if (!ourConvo) {
    throw new Error('insertUserProfileIntoWrapper needs a ourConvo to exist');
  }

  const dbName = ourConvo.get('displayNameInProfile') || '';
  const dbProfileUrl = ourConvo.get('avatarPointer') || '';
  const dbProfileKey = fromHexToArray(ourConvo.get('profileKey') || '');
  const priority = ourConvo.get('priority') || CONVERSATION_PRIORITIES.default;

  const areBlindedMsgRequestEnabled = !!Storage.get(SettingsKey.hasBlindedMsgRequestsEnabled);

  const expirySeconds = ourConvo.getExpireTimer() || 0;
  window.log.debug(
    `inserting into userprofile wrapper: username:"${dbName}", priority:${priority} image:${JSON.stringify(
      {
        url: dbProfileUrl,
        key: dbProfileKey,
      }
    )}, settings: ${JSON.stringify({
      areBlindedMsgRequestEnabled,
      expirySeconds,
    })}`
  );

  // we don't want to throw if somehow our display name in the DB is too long here, so we use the truncated version.
  await UserConfigWrapperActions.setNameTruncated(dbName);
  await UserConfigWrapperActions.setPriority(priority);
  if (dbProfileUrl && !isEmpty(dbProfileKey)) {
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
