import { randombytes_buf } from 'libsodium-wrappers-sumo';

import { uploadFileToFsWithOnionV4 } from '../../session/apis/file_server_api/FileServerApi';
import { processNewAttachment } from '../../types/MessageAttachment';
import { encryptProfile } from '../../util/crypto/profileEncrypter';
import type { ConversationModel } from '../../models/conversation';
import { processAvatarData } from '../../util/avatar/processAvatarData';
import {
  MultiEncryptWrapperActions,
  UserConfigWrapperActions,
} from '../../webworker/workers/browser/libsession_worker_interface';
import { UserUtils } from '../../session/utils';
import { fromBase64ToArray } from '../../session/utils/String';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';

export async function uploadAndSetOurAvatarShared({
  decryptedAvatarData,
  ourConvo,
  context,
}: {
  ourConvo: ConversationModel;
  decryptedAvatarData: ArrayBuffer;
  context: 'uploadNewAvatar' | 'reuploadAvatar';
}) {
  if (!decryptedAvatarData?.byteLength) {
    window.log.warn('uploadAndSetOurAvatarShared: avatar content is empty');
    return null;
  }
  // Note: we want to encrypt & upload the **processed** avatar
  // below (resized & converted), not the original one.
  const { avatarFallback, mainAvatarDetails } = await processAvatarData(decryptedAvatarData, true);

  let encryptedData: ArrayBuffer;
  let encryptionKey: Uint8Array;
  const deterministicEncryption = getFeatureFlag('useDeterministicEncryption');
  const isAnimated = mainAvatarDetails.isAnimated;
  if (deterministicEncryption) {
    const encryptedContent = await MultiEncryptWrapperActions.attachmentEncrypt({
      allowLarge: false,
      seed: await UserUtils.getUserEd25519Seed(),
      data: new Uint8Array(mainAvatarDetails.outputBuffer),
      domain: 'profilePic',
    });
    encryptedData = encryptedContent.encryptedData;
    encryptionKey = encryptedContent.encryptionKey;
  } else {
    // if this is a reupload, reuse the current profile key. Otherwise generate a new one
    const existingProfileKey = ourConvo.getProfileKey();
    const profileKey =
      context === 'reuploadAvatar' && existingProfileKey
        ? fromBase64ToArray(existingProfileKey)
        : randombytes_buf(32);
    encryptedData = await encryptProfile(mainAvatarDetails.outputBuffer, profileKey);
    encryptionKey = profileKey;
  }

  const avatarPointer = await uploadFileToFsWithOnionV4(encryptedData, deterministicEncryption);
  if (!avatarPointer) {
    window.log.warn('failed to upload avatar to file server');
    return null;
  }
  // Note: we don't care about the expiry of the file anymore.
  // This is because we renew the expiry of the file itself, and only when that fails we reupload the avatar content.
  const { fileUrl } = avatarPointer;

  // Note: processing the avatar here doesn't change the buffer (unless the first one was uploaded as an image too big for an avatar.)
  // so, once we have deterministic encryption of avatars, the uploaded should always have the same hash

  // this encrypts and save the new avatar and returns a new attachment path
  const savedMainAvatar = await processNewAttachment({
    isRaw: true,
    data: mainAvatarDetails.outputBuffer,
    contentType: mainAvatarDetails.contentType,
  });

  const processedFallbackAvatar = avatarFallback
    ? await processNewAttachment({
        isRaw: true,
        data: avatarFallback.outputBuffer,
        contentType: avatarFallback.contentType,
      })
    : null;

  // Replace our temporary image with the attachment pointer from the server.
  // Note: this commits already to the DB.
  await ourConvo.setSessionProfile({
    avatarPath: savedMainAvatar.path,
    fallbackAvatarPath: processedFallbackAvatar?.path || savedMainAvatar.path,
    displayName: null,
    avatarPointer: fileUrl,
    type: 'setAvatarDownloadedPrivate',
    profileKey: encryptionKey,
  });
  if (context === 'uploadNewAvatar') {
    await UserConfigWrapperActions.setNewProfilePic({
      key: encryptionKey,
      url: fileUrl,
    });
    await UserConfigWrapperActions.setAnimatedAvatar(isAnimated);
  } else if (context === 'reuploadAvatar') {
    await UserConfigWrapperActions.setReuploadProfilePic({
      key: encryptionKey,
      url: fileUrl,
    });
  }

  return {
    avatarPointer: ourConvo.getAvatarPointer(),
    profileKey: ourConvo.getProfileKey(),
  };
}
