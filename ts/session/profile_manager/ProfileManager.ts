import { isNil } from 'lodash';
import { ConvoHub } from '../conversations';
import {
  getCachedUserConfig,
  UserConfigWrapperActions,
} from '../../webworker/workers/browser/libsession/libsession_worker_userconfig_interface';
import { SyncUtils, UserUtils } from '../utils';
import { trimWhitespace } from '../utils/String';
import { AvatarDownload } from '../utils/job_runners/jobs/AvatarDownloadJob';
import { ConversationTypeEnum } from '../../models/types';
import { RetrieveDisplayNameError } from '../utils/errors';
import { NetworkTime } from '../../util/NetworkTime';
import {
  SessionDisplayNameOnlyPrivate,
  type SessionProfilePrivateChange,
} from '../../models/profile';

/**
 * This can be used to update our conversation display name with the given name right away, and plan an AvatarDownloadJob to retrieve the new avatar if needed to download it
 */
async function updateOurProfileSync(profile: SessionProfilePrivateChange, priority: number | null) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  const ourConvo = ConvoHub.use().get(us);
  if (!ourConvo?.id) {
    window?.log?.warn('[profileupdate] Cannot update our profile without convo associated');
    return;
  }

  const changes = await profile.applyChangesIfNeeded();

  if (changes.avatarNeedsDownload) {
    await AvatarDownload.addAvatarDownloadJob({
      conversationId: profile.getConvoId(),
    });
  }

  if (priority !== null) {
    await ourConvo.setPriorityFromWrapper(priority, true);
  }
}

/**
 * This can be used to update the display name of the given pubkey right away, and plan an AvatarDownloadJob to retrieve the new avatar if needed to download it.
 */
async function updateProfileOfContact(profile: SessionProfilePrivateChange) {
  const changes = await profile.applyChangesIfNeeded();

  if (changes.avatarNeedsDownload) {
    // this call will download the new avatar or reset the local filepath if needed
    await AvatarDownload.addAvatarDownloadJob({
      conversationId: profile.getConvoId(),
    });
  }
}

/**
 * This will throw if the display name given is too long.
 * When registering a user/linking a device, we want to enforce a limit on the displayName length.
 * That limit is enforced by libsession when calling `setName` on the `UserConfigWrapper`.
 * `updateOurProfileDisplayNameOnboarding` is used to create a temporary `UserConfigWrapper`, call `setName` on it and release the memory used by the wrapper.
 * @returns the set displayName set if no error where thrown
 * @note Make sure the displayName has been trimmed and validated first.
 */
async function updateOurProfileDisplayNameOnboarding(newName: string) {
  try {
    // create a temp user config wrapper to test the display name with libsession
    const privKey = new Uint8Array(64);
    crypto.getRandomValues(privKey);
    await UserConfigWrapperActions.init(privKey, null);
    // this throws if the name is too long
    await UserConfigWrapperActions.setName(newName);
    const appliedName = getCachedUserConfig().name;

    if (isNil(appliedName)) {
      throw new RetrieveDisplayNameError();
    }

    return appliedName;
  } finally {
    await UserConfigWrapperActions.free();
  }
}

async function updateOurProfileDisplayName(newName: string) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  const conversation = await ConvoHub.use().getOrCreateAndWait(us, ConversationTypeEnum.PRIVATE);

  // we don't want to throw if somehow our display name in the DB is too long here, so we use the truncated version.
  await UserConfigWrapperActions.setNameTruncated(trimWhitespace(newName));
  const truncatedName = getCachedUserConfig().name;
  if (isNil(truncatedName)) {
    throw new RetrieveDisplayNameError();
  }

  const profile = new SessionDisplayNameOnlyPrivate({
    convo: conversation,
    displayName: newName,
    profileUpdatedAtSeconds: NetworkTime.nowSeconds(),
  });
  await profile.applyChangesIfNeeded();

  // might be good to not trigger a sync if the name did not change
  await conversation.commit();
  void SyncUtils.forceSyncConfigurationNowIfNeeded(true);

  return truncatedName;
}

export const ProfileManager = {
  updateOurProfileSync,
  updateProfileOfContact,
  updateOurProfileDisplayName,
  updateOurProfileDisplayNameOnboarding,
};
