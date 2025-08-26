import { isEmpty } from 'lodash';
import { SettingsKey } from '../../data/settings-key';
import { uploadFileToFsWithOnionV4 } from '../../session/apis/file_server_api/FileServerApi';
import { ConvoHub } from '../../session/conversations';
import { DecryptedAttachmentsManager } from '../../session/crypto/DecryptedAttachmentsManager';
import { UserUtils } from '../../session/utils';
import { fromHexToArray, toHex } from '../../session/utils/String';
import { urlToBlob } from '../../types/attachments/VisualAttachment';
import { processNewAttachment } from '../../types/MessageAttachment';
import { IMAGE_JPEG } from '../../types/MIME';
import { encryptProfile } from '../../util/crypto/profileEncrypter';
import { Storage } from '../../util/storage';
import type { ConversationModel } from '../../models/conversation';
import { processAvatarData } from '../../util/avatar/processAvatarData';

/**
 * This function can be used for reupload our avatar to the file server.
 * It will reuse the same profileKey and avatarContent if we have some, or do nothing if one of those is missing.
 */
export async function reuploadCurrentAvatarUs() {
  const ourConvo = ConvoHub.use().get(UserUtils.getOurPubKeyStrFromCache());
  if (!ourConvo) {
    window.log.warn('ourConvo not found... This is not a valid case');
    return null;
  }

  // this is a reupload. no need to generate a new profileKey
  const ourConvoProfileKey =
    ConvoHub.use().get(UserUtils.getOurPubKeyStrFromCache())?.getProfileKey() || null;

  const profileKey = ourConvoProfileKey ? fromHexToArray(ourConvoProfileKey) : null;
  if (!profileKey || isEmpty(profileKey)) {
    window.log.info('reuploadCurrentAvatarUs: our profileKey empty');

    return null;
  }
  // Note: we do want to grab the current non-static avatar path here
  // to reupload it, no matter if we are a pro user or not.
  const currentNonStaticAvatarPath = ourConvo.getAvatarInProfilePath();

  if (!currentNonStaticAvatarPath) {
    window.log.info('No attachment currently set for our convo.. Nothing to do.');
    return null;
  }

  const decryptedAvatarUrl = await DecryptedAttachmentsManager.getDecryptedMediaUrl(
    currentNonStaticAvatarPath,
    IMAGE_JPEG,
    true
  );

  if (!decryptedAvatarUrl) {
    window.log.warn('Could not decrypt avatar stored locally..');
    return null;
  }
  const blob = await urlToBlob(decryptedAvatarUrl);

  const decryptedAvatarData = await blob.arrayBuffer();

  return uploadAndSetOurAvatarShared({
    decryptedAvatarData,
    ourConvo,
    profileKey,
  });
}

export async function uploadAndSetOurAvatarShared({
  decryptedAvatarData,
  ourConvo,
  profileKey,
}: {
  ourConvo: ConversationModel;
  decryptedAvatarData: ArrayBuffer;
  profileKey: Uint8Array;
}) {
  if (!decryptedAvatarData?.byteLength) {
    window.log.warn('uploadAndSetOurAvatarShared: avatar content is empty');
    return null;
  }

  const encryptedData = await encryptProfile(decryptedAvatarData, profileKey);

  const avatarPointer = await uploadFileToFsWithOnionV4(encryptedData);
  if (!avatarPointer) {
    window.log.warn('failed to upload avatar to file server');
    return null;
  }
  const { fileUrl, expiresMs } = avatarPointer;

  // Note: processing the avatar here doesn't change the buffer (unless the first one was uploaded as an image too big for an avatar.)
  // so, once we have deterministic encryption of avatars, the uploaded should always have the same hash
  const { avatarFallback, mainAvatarDetails } = await processAvatarData(decryptedAvatarData);

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
        contentType: avatarFallback.contentType, // contentType is mostly used to generate previews and screenshot. We do not care for those in this case.
      })
    : null;

  const displayName = ourConvo.getRealSessionUsername();

  // write the profileKey even if it did not change
  ourConvo.set({ profileKey: toHex(profileKey) });
  // Replace our temporary image with the attachment pointer from the server.
  // Note: this commits already to the DB.
  await ourConvo.setSessionProfile({
    avatarPath: savedMainAvatar.path,
    fallbackAvatarPath: processedFallbackAvatar?.path || savedMainAvatar.path,
    displayName,
    avatarPointer: fileUrl,
  });
  await Storage.put(SettingsKey.ntsAvatarExpiryMs, expiresMs);

  return {
    avatarPointer: ourConvo.getAvatarPointer(),
    profileKey: ourConvo.getProfileKey(),
  };
}
