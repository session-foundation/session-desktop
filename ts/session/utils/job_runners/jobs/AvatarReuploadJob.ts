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
import { NetworkTime } from '../../../../util/NetworkTime';
import { DURATION, DURATION_SECONDS } from '../../../constants';
import { uploadAndSetOurAvatarShared } from '../../../../interactions/avatar-interactions/nts-avatar-interactions';
import { FS } from '../../../apis/file_server_api/FileServerTarget';

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
      `running job ${this.persistedData.jobType} id:"${this.persistedData.identifier}" `
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
      window.log.warn('AvatarReuploadJob did not find corresponding conversation, or not us');

      return RunJobResult.PermanentFailure;
    }
    const ourProfileLastUpdatedSeconds = await UserConfigWrapperActions.getProfileUpdatedSeconds();
    const currentMainPath = conversation.getAvatarInProfilePath();
    const avatarPointer = conversation.getAvatarPointer();
    const profileKey = conversation.getProfileKey();
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
        metadata.height <= maxAvatarDetails.maxSidePlanReupload &&
        metadata.format === 'webp'
      ) {
        const target = FS.fileUrlToFileTarget(fullUrl?.toString());
        window.log.debug(
          `[avatarReupload] main avatar is already the right size and format for ${ed25519Str(conversation.id)}, just renewing it on fs: ${target}`
        );
        const expiryRenewResult = await extendFileExpiry(fileId, target);

        if (expiryRenewResult) {
          window.log.debug(
            `[avatarReupload] expiry renew for ${ed25519Str(conversation.id)} of file ${fileId} was successful`
          );
          return RunJobResult.Success;
        }

        if (ourProfileLastUpdatedSeconds > NetworkTime.nowSeconds() - 12 * DURATION_SECONDS.DAYS) {
          // `renew` failed but our last reupload was less than 12 days ago, so we we don't want to retry
          window.log.debug(
            `[avatarReupload] expiry renew for ${ed25519Str(conversation.id)} of file ${fileId} failed but our last reupload was less than 12 days ago, so we don't want to retry`
          );
          // considering this to be a success
          return RunJobResult.Success;
        }
        // renew failed, but our last reupload was more than 12 days ago, so we want to reprocess and
        // reupload our current avatar, see below
      }

      // here,
      // - either the format or the size is wrong
      // - or the expiry renew failed and our last reupload was more than 12 days ago
      // in those case, we want to reprocess our current avatar, and reupload it

      window.log.info(`[profileupdate] about to auto scale avatar for convo ${conversation.id}`);

      conversation = ConvoHub.use().getOrThrow(convoId);

      // reprocess the avatar content, and reupload it
      await uploadAndSetOurAvatarShared({
        decryptedAvatarData,
        ourConvo: conversation,
        context: 'reuploadAvatar',
      });
    } catch (e) {
      window.log.warn(`[profileReupload] failed with ${e.message}`);
      return RunJobResult.RetryJobIfPossible;
    }

    // return true so this job is marked as a success
    return RunJobResult.Success;
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
