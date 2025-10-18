import { isNil } from 'lodash';
import { ConvoHub } from '../conversations';
import { UserConfigWrapperActions } from '../../webworker/workers/browser/libsession_worker_interface';
import { SyncUtils, UserUtils } from '../utils';
import { trimWhitespace } from '../utils/String';
import { AvatarDownload } from '../utils/job_runners/jobs/AvatarDownloadJob';
import { ConversationTypeEnum } from '../../models/types';
import { RetrieveDisplayNameError } from '../utils/errors';
import { NetworkTime } from '../../util/NetworkTime';
import type { WithProfileUpdatedAtSeconds } from '../../models/conversationAttributes';

/**
 * This can be used to update our conversation display name with the given name right away, and plan an AvatarDownloadJob to retrieve the new avatar if needed to download it
 */
async function updateOurProfileSync({
  displayName,
  profileUrl,
  profileKey,
  priority,
  profileUpdatedAtSeconds,
}: {
  displayName: string | undefined;
  profileUrl: string | null;
  profileKey: Uint8Array | null;
  priority: number | null; // passing null means to not update the priority at all (used for legacy config message for now)
  profileUpdatedAtSeconds: number;
}) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  const ourConvo = ConvoHub.use().get(us);
  if (!ourConvo?.id) {
    window?.log?.warn('[profileupdate] Cannot update our profile without convo associated');
    return;
  }

  await updateProfileOfContact({
    pubkey: us,
    displayName,
    profileUrl,
    profileKey,
    profileUpdatedAtSeconds,
  });
  if (priority !== null) {
    await ourConvo.setPriorityFromWrapper(priority, true);
  }
}

/**
 * This can be used to update the display name of the given pubkey right away, and plan an AvatarDownloadJob to retrieve the new avatar if needed to download it.
 */
async function updateProfileOfContact({
  pubkey,
  displayName,
  profileKey,
  profileUrl,
  profileUpdatedAtSeconds,
}: {
  pubkey: string;
  displayName: string | null | undefined;
  profileUrl: string | null | undefined;
  profileKey: Uint8Array | null | undefined;
} & WithProfileUpdatedAtSeconds) {
  const conversation = ConvoHub.use().get(pubkey);

  if (!conversation || !conversation.isPrivate()) {
    window.log.warn('updateProfileOfContact can only be used for existing and private convos');
    return;
  }
  let changes;

  // we have to set it right away and not in the async download job, as the next .commit will save it to the
  // database and wrapper (and we do not want to override anything in the wrapper's content
  // with what we have locally, so we need the commit to have already the right values in pointer and profileKey)

  if (profileUrl && profileKey) {
    changes = await conversation.setSessionProfile({
      type: 'setAvatarBeforeDownloadPrivate',
      profileKey,
      avatarPointer: profileUrl,
      displayName,
      profileUpdatedAtSeconds,
    });
  } else {
    changes = await conversation.setSessionProfile({
      type: 'resetAvatarPrivate',
      profileUpdatedAtSeconds,
      displayName,
    });
  }

  if (changes.nameChanged || changes.avatarChanged) {
    await conversation.commit();
  }

  if (changes.avatarNeedsDownload) {
    // this call will download the new avatar or reset the local filepath if needed
    await AvatarDownload.addAvatarDownloadJob({
      conversationId: pubkey,
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
    const appliedName = await UserConfigWrapperActions.getName();

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
  const truncatedName = await UserConfigWrapperActions.getName();
  if (isNil(truncatedName)) {
    throw new RetrieveDisplayNameError();
  }

  await conversation.setSessionProfile({
    type: 'displayNameChangeOnlyPrivate',
    displayName: newName,
    profileUpdatedAtSeconds: NetworkTime.nowSeconds(),
  });

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
