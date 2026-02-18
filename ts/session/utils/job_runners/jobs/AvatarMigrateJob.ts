import { isNumber } from 'lodash';
import { processNewAttachment } from '../../../../types/MessageAttachment';
import { ConvoHub } from '../../../conversations';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  PersistedJob,
  RunJobResult,
  type AvatarMigratePersistedData,
} from '../PersistedJob';
import { processAvatarData } from '../../../../util/avatar/processAvatarData';
import { DecryptedAttachmentsManager } from '../../../crypto/DecryptedAttachmentsManager';
import { IMAGE_JPEG } from '../../../../types/MIME';
import { NetworkTime } from '../../../../util/NetworkTime';
import {
  SessionProfileResetAvatarPrivate,
  SessionProfileSetAvatarDownloadedAny,
} from '../../../../models/profile';
import { uuidV4 } from '../../../../util/uuid';

const defaultMsBetweenRetries = 10000;
const defaultMaxAttempts = 3;

function shouldAddAvatarMigrateJob({ conversationId }: { conversationId: string }) {
  const conversation = ConvoHub.use().get(conversationId);
  if (!conversation) {
    window.log.warn('shouldAddAvatarMigrateJob: no corresponding conversation');

    return false;
  }
  if (!conversation.isPrivate()) {
    window.log.debug('shouldAddAvatarMigrateJob can only be used for private chats');
    return false;
  }
  const hasAvatar = conversation.getAvatarInProfilePath();
  const hasFallbackSet = conversation.getFallbackAvatarInProfilePath();

  if (!hasAvatar) {
    return false;
  }

  if (hasFallbackSet) {
    // this means we have processed that conversation already. No need to migrate it.
    return false;
  }

  return true;
}

async function addAvatarMigrateJob({ conversationId }: { conversationId: string }) {
  if (shouldAddAvatarMigrateJob({ conversationId })) {
    const avatarMigrateJob = new AvatarMigrateJob({
      conversationId,
      nextAttemptTimestamp: Date.now(),
    });
    window.log.debug(`addAvatarMigrateJob: adding job migrate for ${conversationId} `);
    await runners.avatarMigrateRunner.addJob(avatarMigrateJob);
  }
}

/**
 * This is a temporary job runner to migrate the avatar of a conversation to the new avatar system.
 * We should probably remove it in 6 months time.
 * What is does, is generated the static images from the avatars that are animated, and store them in the database.
 */
class AvatarMigrateJob extends PersistedJob<AvatarMigratePersistedData> {
  constructor({
    conversationId,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
    identifier,
  }: Pick<AvatarMigratePersistedData, 'conversationId'> &
    Partial<
      Pick<
        AvatarMigratePersistedData,
        'nextAttemptTimestamp' | 'identifier' | 'maxAttempts' | 'currentRetry'
      >
    >) {
    super({
      jobType: 'AvatarMigrateJobType',
      identifier: identifier || uuidV4(),
      conversationId,
      delayBetweenRetries: defaultMsBetweenRetries,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : defaultMaxAttempts,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now() + defaultMsBetweenRetries,
      currentRetry: isNumber(currentRetry) ? currentRetry : 0,
    });
  }

  public async run(): Promise<RunJobResult> {
    const convoId = this.persistedData.conversationId;

    window.log.debug(`running job ${this.persistedData.jobType} with conversationId:"${convoId}"`);

    if (!this.persistedData.identifier || !convoId) {
      return RunJobResult.Success;
    }

    let conversation = ConvoHub.use().get(convoId);
    if (!conversation) {
      window.log.warn('AvatarMigrateJob did not corresponding conversation');

      return RunJobResult.Success;
    }
    if (!conversation.isPrivate()) {
      window.log.warn('AvatarMigrateJob can only be used for private or groupv2 convos');
      return RunJobResult.Success;
    }

    const existingAvatarPointer = conversation.getAvatarPointer();
    if (!existingAvatarPointer) {
      window.log.warn('AvatarMigrateJob: no avatar pointer found for conversation');
      return RunJobResult.Success;
    }
    const existingProfileKeyHex = conversation.getProfileKeyHex();
    if (!existingProfileKeyHex) {
      window.log.warn('AvatarMigrateJob: no profileKey found for conversation');
      return RunJobResult.Success;
    }
    const avatarPath = conversation.getAvatarInProfilePath();
    if (!avatarPath) {
      window.log.warn('AvatarMigrateJob: no avatar path found for conversation');
      return RunJobResult.Success;
    }

    try {
      const decryptedBlob = await DecryptedAttachmentsManager.getDecryptedBlob(
        avatarPath,
        IMAGE_JPEG
      );

      const decryptedData = await decryptedBlob.arrayBuffer();

      if (!decryptedData) {
        const profile = new SessionProfileResetAvatarPrivate({
          convo: conversation,
          displayName: null, // null to not update the display name.
          // this is the AvatarMigrateJob.
          // We want to override the avatars that was stored for that user
          // as we can't decrypt it.
          profileUpdatedAtSeconds: NetworkTime.nowSeconds(),
          // Don't overwrite those if they are set
          proDetails: { bitsetProFeatures: null, proExpiryTsMs: null, proGenIndexHashB64: null },
        });
        await profile.applyChangesIfNeeded();

        return RunJobResult.Success;
      }

      // we autoscale incoming avatars because our app keeps decrypted avatars in memory and some platforms allows large avatars to be uploaded.
      const processed = await processAvatarData(decryptedData, conversation.isMe(), true);

      const upgradedMainAvatar = await processNewAttachment({
        data: processed.mainAvatarDetails.outputBuffer,
        contentType: processed.mainAvatarDetails.contentType,
      });
      const upgradedFallbackAvatar = processed.avatarFallback
        ? await processNewAttachment({
            data: processed.avatarFallback.outputBuffer,
            contentType: processed.avatarFallback.contentType,
          })
        : null;
      const mainAvatarPath = upgradedMainAvatar.path;
      const fallbackAvatarPath = upgradedFallbackAvatar?.path || upgradedMainAvatar.path;
      conversation = ConvoHub.use().getOrThrow(convoId);

      const profile = new SessionProfileSetAvatarDownloadedAny({
        convo: conversation,
        displayName: null, // null to not update the display name.
        avatarPath: mainAvatarPath,
        fallbackAvatarPath,
        avatarPointer: existingAvatarPointer,
        profileKey: existingProfileKeyHex,
      });

      await profile.applyChangesIfNeeded();

      return RunJobResult.Success;
    } catch (e) {
      window.log.warn(`failed to process avatar for ${convoId}`, e.message);
      // if we failed multiple times, and before we are out of retries, remove the saved avatar altogether.
      // it will be re downloaded by the AvatarDownloadJob if needed
      conversation = ConvoHub.use().get(convoId);

      if (
        conversation &&
        (conversation.getAvatarInProfilePath() || conversation.getFallbackAvatarInProfilePath())
      ) {
        // there is no valid avatar to download, make sure the local file of the avatar of that user is removed
        const profile = new SessionProfileResetAvatarPrivate({
          convo: conversation,
          displayName: null, // null to not update the display name.
          // this is the AvatarMigrateJob.
          // We want to override the avatar that was stored for that user
          // as we can't decrypt it.
          profileUpdatedAtSeconds: NetworkTime.nowSeconds(),
          // Don't overwrite those if they are set
          proDetails: { bitsetProFeatures: null, proExpiryTsMs: null, proGenIndexHashB64: null },
        });
        await profile.applyChangesIfNeeded();
      }
      return RunJobResult.RetryJobIfPossible;
    }
  }

  public serializeJob(): AvatarMigratePersistedData {
    return super.serializeBase();
  }

  public nonRunningJobsToRemove(_jobs: Array<AvatarMigratePersistedData>) {
    return [];
  }

  public addJobCheck(jobs: Array<AvatarMigratePersistedData>): AddJobCheckReturn {
    // avoid adding the same job if the exact same one is already planned
    const hasSameJob = jobs.some(j => {
      return j.conversationId === this.persistedData.conversationId;
    });

    if (hasSameJob) {
      return 'skipAddSameJobPresent';
    }

    return null;
  }

  public getJobTimeoutMs(): number {
    return 10000;
  }
}

async function scheduleAllAvatarMigrateJobs() {
  const conversations = ConvoHub.use().getConversations();

  for (let index = 0; index < conversations.length; index++) {
    const conversation = conversations[index];
    if (shouldAddAvatarMigrateJob({ conversationId: conversation.id })) {
      window.log.debug(`[avatarMigrate] scheduling avatar migrate job for ${conversation.id}`);
      // eslint-disable-next-line no-await-in-loop
      await addAvatarMigrateJob({
        conversationId: conversation.id,
      });
    }
  }
}

export const AvatarMigrate = {
  scheduleAllAvatarMigrateJobs,
  AvatarMigrateJob,
};
