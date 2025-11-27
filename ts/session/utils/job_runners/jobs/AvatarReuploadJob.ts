import { from_hex } from 'libsodium-wrappers-sumo';
import { isNumber } from 'lodash';
import { v4 } from 'uuid';
import { UserUtils } from '../..';
import { ConvoHub } from '../../../conversations';
import { ed25519Str } from '../../String';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  AvatarDownloadPersistedData,
  PersistedJob,
  RunJobResult,
  type AvatarReuploadPersistedData,
} from '../PersistedJob';
import { DecryptedAttachmentsManager } from '../../../crypto/DecryptedAttachmentsManager';
import { IMAGE_JPEG } from '../../../../types/MIME';
import { urlToBlob } from '../../../../types/attachments/VisualAttachment';
import { ImageProcessor } from '../../../../webworker/workers/browser/image_processor_interface';
import { maxAvatarDetails } from '../../../../util/attachment/attachmentSizes';
import { UserConfigWrapperActions } from '../../../../webworker/workers/browser/libsession_worker_interface';
import { extendFileExpiry } from '../../../apis/file_server_api/FileServerApi';
import { fileServerUrlToFileId } from '../../../apis/file_server_api/types';
import { DURATION, DURATION_SECONDS } from '../../../constants';
import { uploadAndSetOurAvatarShared } from '../../../../interactions/avatar-interactions/nts-avatar-interactions';
import { FS } from '../../../apis/file_server_api/FileServerTarget';
import { getFeatureFlag } from '../../../../state/ducks/types/releasedFeaturesReduxTypes';

const defaultMsBetweenRetries = 10000;
const defaultMaxAttempts = 3;

async function addAvatarReuploadJob() {
  const avatarReuploadJob = new AvatarReuploadJob({
    // postpone this job for 30 seconds, so we don't reupload right on start (we need an onion path to be valid)
    nextAttemptTimestamp: Date.now() + DURATION.SECONDS * 30,
    conversationId: UserUtils.getOurPubKeyStrFromCache(),
  });
  window.log.debug(`addAvatarReuploadJob: adding job reupload `);
  await runners.avatarReuploadRunner.addJob(avatarReuploadJob);
}

async function fetchLocalAvatarDetails(currentMainPath: string) {
  try {
    const decryptedAvatarLocalUrl = await DecryptedAttachmentsManager.getDecryptedMediaUrl(
      currentMainPath,
      IMAGE_JPEG, // not needed
      true
    );

    if (!decryptedAvatarLocalUrl) {
      window.log.warn('Could not decrypt avatar stored locally..');
      return null;
    }
    const blob = await urlToBlob(decryptedAvatarLocalUrl);
    const decryptedAvatarData = await blob.arrayBuffer();
    const metadata = await ImageProcessor.imageMetadata(decryptedAvatarData);
    if (!metadata) {
      window.log.warn('Failed to get metadata from avatar');
      return null;
    }
    return { decryptedAvatarData, metadata };
  } catch (e) {
    window.log.warn('[avatarReupload] Failed to get metadata from avatar');
    return null;
  }
}

/**
 * Returns the current timestamp in seconds.
 * Note: this is not the network time, but our local time with an offset, potentially.
 * We want to use that one here, as the UserProfile actions are not based on the network timestamp either.k
 */
function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function shouldSkipRenew({
  ourProfileLastUpdatedSeconds,
}: {
  ourProfileLastUpdatedSeconds: number;
}) {
  if (getFeatureFlag('fsTTL30s')) {
    // this is in dev
    return Date.now() / 1000 - ourProfileLastUpdatedSeconds <= 10 * DURATION_SECONDS.SECONDS;
  }
  // this is in prod
  return nowSeconds() - ourProfileLastUpdatedSeconds <= 2 * DURATION_SECONDS.HOURS;
}

function shouldSkipReupload({
  ourProfileLastUpdatedSeconds,
}: {
  ourProfileLastUpdatedSeconds: number;
}) {
  if (getFeatureFlag('fsTTL30s')) {
    return nowSeconds() - ourProfileLastUpdatedSeconds <= 10 * DURATION_SECONDS.SECONDS;
  }
  return nowSeconds() - ourProfileLastUpdatedSeconds <= 12 * DURATION_SECONDS.DAYS;
}

class AvatarReuploadJob extends PersistedJob<AvatarReuploadPersistedData> {
  constructor({
    conversationId,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
    identifier,
  }: Pick<AvatarReuploadPersistedData, 'conversationId'> &
    Partial<
      Pick<
        AvatarDownloadPersistedData,
        'nextAttemptTimestamp' | 'identifier' | 'maxAttempts' | 'currentRetry'
      >
    >) {
    super({
      jobType: 'AvatarReuploadJobType',
      identifier: identifier || v4(),
      conversationId,
      delayBetweenRetries: defaultMsBetweenRetries,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : defaultMaxAttempts,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now() + defaultMsBetweenRetries,
      currentRetry: isNumber(currentRetry) ? currentRetry : 0,
    });
  }

  public async run(): Promise<RunJobResult> {
    const convoId = this.persistedData.conversationId;
    window.log.debug(
      `[avatarReupload] running job ${this.persistedData.jobType} id:"${this.persistedData.identifier}" `
    );

    if (!this.persistedData.identifier) {
      return RunJobResult.PermanentFailure;
    }
    if (!convoId) {
      return RunJobResult.PermanentFailure;
    }

    let conversation = ConvoHub.use().get(convoId);
    if (!conversation || !conversation.isMe()) {
      // Note: if we add the groupv2 case here, we'd need to add a profile_updated timestamp to the metagroup wrapper
      window.log.warn('[avatarReupload] did not find corresponding conversation, or not us');

      return RunJobResult.PermanentFailure;
    }
    const ourProfileLastUpdatedSeconds = await UserConfigWrapperActions.getProfileUpdatedSeconds();
    const currentMainPath = conversation.getAvatarInProfilePath();
    const avatarPointer = conversation.getAvatarPointer();
    const profileKey = conversation.getProfileKeyHex();
    const { fileId, fullUrl } = fileServerUrlToFileId(avatarPointer);
    if (!currentMainPath || !avatarPointer || !profileKey || !fullUrl) {
      // we do not have an avatar to reupload, nothing to do.
      return RunJobResult.Success;
    }

    try {
      const currentAvatarDetails = await fetchLocalAvatarDetails(currentMainPath);
      if (!currentAvatarDetails) {
        return RunJobResult.RetryJobIfPossible;
      }
      const { decryptedAvatarData, metadata } = currentAvatarDetails;

      window.log.debug(`[avatarReupload] starting for ${ed25519Str(conversation.id)}`);

      if (
        ourProfileLastUpdatedSeconds !== 0 &&
        metadata.width <= maxAvatarDetails.maxSidePlanReupload &&
        metadata.height <= maxAvatarDetails.maxSidePlanReupload
      ) {
        const target = FS.fileUrlToFileTarget(fullUrl?.toString());
        window.log.debug(
          `[avatarReupload] main avatar is already the right size for ${ed25519Str(conversation.id)} target:${target}`
        );
        if (shouldSkipRenew({ ourProfileLastUpdatedSeconds })) {
          // we don't want to call `renew` too often. Only once every 2hours (or more when the fsTTL30s feature is enabled)
          window.log.debug(
            `[avatarReupload] not trying to renew avatar for ${ed25519Str(conversation.id)} of file ${fileId} as we did one recently`
          );
          // considering this to be a success
          return RunJobResult.Success;
        }
        window.log.debug(
          `[avatarReupload] renewing avatar on fs: ${target} for ${ed25519Str(conversation.id)} and file:${fileId}`
        );
        const expiryRenewResult = await extendFileExpiry(fileId, target);

        if (expiryRenewResult) {
          window.log.debug(
            `[avatarReupload] expiry renew for ${ed25519Str(conversation.id)} of file:${fileId} on fs: ${target} was successful`
          );

          await UserConfigWrapperActions.getProfilePic();

          await UserConfigWrapperActions.setReuploadProfilePic({
            key: from_hex(profileKey),
            url: avatarPointer,
          });

          return RunJobResult.Success;
        }
        window.log.debug(
          `[avatarReupload] expiry renew for ${ed25519Str(conversation.id)} of file:${fileId} on fs: ${target} failed`
        );

        // AUDRIC: expiry renew for (...efb27b5b) of file:Ff1CvAQIo1BXCeoV3DwTjYEzSoBPZW56FeExk8qij79h on fs: POTATO failed
        // keep failing even whe it shouldnt

        if (shouldSkipReupload({ ourProfileLastUpdatedSeconds })) {
          window.log.debug(
            `[avatarReupload] ${ed25519Str(conversation.id)} last reupload was recent enough, so we don't want to reupload it`
          );
          // considering this to be a success
          return RunJobResult.Success;
        }
        // renew failed, and our last reupload was not too recent, so we want to reprocess and
        // reupload our current avatar, see below...
      }

      // here,
      // - either the format or the size is wrong
      // - or we do not have a ourProfileLastUpdatedSeconds yet
      // - or the expiry renew failed and our last reupload not recent
      // In all those cases, we want to reprocess our current avatar, and reupload it.

      window.log.info(
        `[avatarReupload] about to auto scale avatar for convo ${ed25519Str(conversation.id)}`
      );

      conversation = ConvoHub.use().getOrThrow(convoId);

      // Reprocess the avatar content, and reupload it
      // This will pick the correct file server depending on the env variables set.
      const details = await uploadAndSetOurAvatarShared({
        decryptedAvatarData,
        ourConvo: conversation,
        context: 'reuploadAvatar',
      });
      if (!details?.avatarPointer) {
        window.log.warn(
          `[avatarReupload] failed to reupload avatar for ${ed25519Str(conversation.id)}`
        );
        throw new Error('details.avatarPointer is not valid after uploadAndSetOurAvatarShared');
      }
      window.log.info(
        `[avatarReupload] reupload done for ${ed25519Str(conversation.id)}: ${details?.avatarPointer}`
      );
      return RunJobResult.Success;
    } catch (e) {
      window.log.warn(`[avatarReupload] failed with ${e.message}`);
      return RunJobResult.RetryJobIfPossible;
    }
  }

  public serializeJob(): AvatarReuploadPersistedData {
    return super.serializeBase();
  }

  public nonRunningJobsToRemove(_jobs: Array<AvatarReuploadPersistedData>) {
    return [];
  }

  public addJobCheck(_jobs: Array<AvatarReuploadPersistedData>): AddJobCheckReturn {
    return null;
  }

  public getJobTimeoutMs(): number {
    return 10000;
  }
}

export const AvatarReupload = {
  AvatarReuploadJob,
  addAvatarReuploadJob,
};
