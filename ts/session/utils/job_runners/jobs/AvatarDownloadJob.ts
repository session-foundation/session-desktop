import { isEmpty, isNumber, isString } from 'lodash';
import { v4 } from 'uuid';
import { UserUtils } from '../..';
import { processNewAttachment } from '../../../../types/MessageAttachment';
import { decryptProfile } from '../../../../util/crypto/profileEncrypter';
import { ConvoHub } from '../../../conversations';
import { ed25519Str, fromHexToArray } from '../../String';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  AvatarDownloadPersistedData,
  PersistedJob,
  RunJobResult,
} from '../PersistedJob';
import { processAvatarData } from '../../../../util/avatar/processAvatarData';
import { downloadAttachmentFs } from '../../../../receiver/attachments';
import { extractDetailsFromUrlFragment } from '../../../url';
import { MultiEncryptWrapperActions } from '../../../../webworker/workers/browser/libsession_worker_interface';

const defaultMsBetweenRetries = 10000;
const defaultMaxAttempts = 3;

/**
 * Returns true if the provided conversationId is a private chat and that we should add an Avatar Download Job to the list of jobs to run.
 * Before calling this function, you have to update the related conversation profileKey and avatarPointer fields with the urls which should be downloaded, or reset them if you wanted them reset.
 */
export function shouldAddAvatarDownloadJob({ conversationId }: { conversationId: string }) {
  const conversation = ConvoHub.use().get(conversationId);
  if (!conversation) {
    window.log.warn('shouldAddAvatarDownloadJob: no corresponding conversation');

    return false;
  }
  if (!conversation.isPrivate() && !conversation.isClosedGroupV2()) {
    window.log.warn('shouldAddAvatarDownloadJob can only be used for private or groupv2 convos');
    return false;
  }
  const prevPointer = conversation.getAvatarPointer();
  const profileKey = conversation.getProfileKey();
  const hasNoAvatar = isEmpty(prevPointer) || isEmpty(profileKey);

  if (hasNoAvatar) {
    return false;
  }

  return true;
}

async function addAvatarDownloadJob({ conversationId }: { conversationId: string }) {
  if (shouldAddAvatarDownloadJob({ conversationId })) {
    const avatarDownloadJob = new AvatarDownloadJob({
      conversationId,
      nextAttemptTimestamp: Date.now(),
    });
    window.log.debug(`addAvatarDownloadJobIfNeeded: adding job download for ${conversationId} `);
    await runners.avatarDownloadRunner.addJob(avatarDownloadJob);
  }
}

/**
 * This job can be used to add the downloading of the avatar of a conversation to the list of jobs to be run.
 * The conversationId is used as identifier so we can only have a single job per conversation.
 * When the jobRunners starts this job, the job first checks if a download is required or not (avatarPointer changed and wasn't already downloaded).
 * If yes, it downloads the new avatar, decrypt it and store it before updating the conversation with the new url, profile key and local file storage.
 */
class AvatarDownloadJob extends PersistedJob<AvatarDownloadPersistedData> {
  constructor({
    conversationId,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
    identifier,
  }: Pick<AvatarDownloadPersistedData, 'conversationId'> &
    Partial<
      Pick<
        AvatarDownloadPersistedData,
        'nextAttemptTimestamp' | 'identifier' | 'maxAttempts' | 'currentRetry'
      >
    >) {
    super({
      jobType: 'AvatarDownloadJobType',
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
      `running job ${this.persistedData.jobType} with conversationId:"${convoId}" id:"${this.persistedData.identifier}" `
    );

    if (!this.persistedData.identifier || !convoId) {
      return RunJobResult.PermanentFailure;
    }

    let conversation = ConvoHub.use().get(convoId);
    if (!conversation) {
      window.log.warn('AvatarDownloadJob did not corresponding conversation');

      return RunJobResult.PermanentFailure;
    }
    if (!conversation.isPrivate() && !conversation.isClosedGroupV2()) {
      window.log.warn('AvatarDownloadJob can only be used for private or groupv2 convos');
      return RunJobResult.PermanentFailure;
    }
    let changes = false;
    const toDownloadPointer = conversation.getAvatarPointer();
    const toDownloadProfileKey = conversation.getProfileKey();

    // if there is an avatar and profileKey for that user/group ('', null and undefined excluded), download, decrypt and save the avatar locally.
    if (toDownloadPointer && toDownloadProfileKey) {
      try {
        window.log.debug(`[profileupdate] starting downloading task for  ${conversation.id}`);
        // This is an avatar download, we are free to resize/compress/convert what is downloaded as we wish.
        // Desktop will generate a normal avatar and a forced static one. Both resized and converted if required.
        const downloaded = await downloadAttachmentFs({
          url: toDownloadPointer,
          isRaw: true,
        });
        const { deterministicEncryption } = extractDetailsFromUrlFragment(
          new URL(toDownloadPointer)
        );
        conversation = ConvoHub.use().getOrThrow(convoId);

        if (!downloaded.data.byteLength) {
          window.log.debug(`[profileupdate] downloaded data is empty for  ${conversation.id}`);
          return RunJobResult.RetryJobIfPossible; // so we retry this job
        }

        // null => use placeholder with color and first letter
        let mainAvatarPath: string | null = null;
        let fallbackAvatarPath: string | null = null;

        try {
          const profileKeyArrayBuffer = fromHexToArray(toDownloadProfileKey);
          let decryptedData: ArrayBuffer;
          try {
            if (deterministicEncryption) {
              const { decryptedData: decryptedData2 } =
                await MultiEncryptWrapperActions.attachmentDecrypt({
                  encryptedData: new Uint8Array(downloaded.data),
                  decryptionKey: profileKeyArrayBuffer,
                });
              decryptedData = decryptedData2.buffer;
            } else {
              decryptedData = await decryptProfile(downloaded.data, profileKeyArrayBuffer);
            }
          } catch (decryptError) {
            window.log.info(
              `[profileupdate] failed to decrypt downloaded data for ${ed25519Str(conversation.id)} with provided profileKey`
            );
            // if we got content, but cannot decrypt it with the provided profileKey, there is no need to keep retrying.
            return RunJobResult.PermanentFailure;
          }

          window.log.info(
            `[profileupdate] about to auto scale avatar for convo ${conversation.id}`
          );

          // we autoscale incoming avatars because our app keeps decrypted avatars in memory and some platforms allows large avatars to be uploaded.
          const processed = await processAvatarData(decryptedData, conversation.isMe());

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
          conversation = ConvoHub.use().getOrThrow(convoId);
          mainAvatarPath = upgradedMainAvatar.path;
          fallbackAvatarPath = upgradedFallbackAvatar?.path || upgradedMainAvatar.path;
        } catch (e) {
          window?.log?.error(`[profileupdate] Could not decrypt profile image: ${e}`);
          return RunJobResult.RetryJobIfPossible; // so we retry this job
        }

        await conversation.setSessionProfile({
          type: conversation.isPrivate()
            ? 'setAvatarDownloadedPrivate'
            : 'setAvatarDownloadedGroup',
          displayName: null, // null to not update the display name.
          avatarPath: mainAvatarPath,
          fallbackAvatarPath,
          avatarPointer: toDownloadPointer,
          profileKey: toDownloadProfileKey,
        });

        changes = true;
      } catch (e) {
        // TODO would be nice to throw a specific exception here instead of relying on the error string.
        if (isString(e.message) && (e.message as string).includes('404')) {
          window.log.warn(
            `[profileupdate] Failed to download attachment at ${toDownloadPointer}. We got 404 error: "${e.message}"`
          );
          return RunJobResult.PermanentFailure;
        }
        window.log.warn(
          `[profileupdate] Failed to download attachment at ${toDownloadPointer}. Maybe it expired? ${e.message}`
        );
        return RunJobResult.RetryJobIfPossible;
      }
    }

    if (conversation.id === UserUtils.getOurPubKeyStrFromCache()) {
      // make sure the settings which should already set to `true` are
      if (
        !conversation.get('isTrustedForAttachmentDownload') ||
        !conversation.isApproved() ||
        !conversation.didApproveMe()
      ) {
        conversation.setIsTrustedForAttachmentDownload(true);
        await conversation.setDidApproveMe(true, false);
        await conversation.setIsApproved(true, false);
        changes = true;
      }
    }

    if (changes) {
      await conversation.commit();
    }

    // return true so this job is marked as a success
    return RunJobResult.Success;
  }

  public serializeJob(): AvatarDownloadPersistedData {
    return super.serializeBase();
  }

  public nonRunningJobsToRemove(_jobs: Array<AvatarDownloadPersistedData>) {
    return [];
  }

  public addJobCheck(jobs: Array<AvatarDownloadPersistedData>): AddJobCheckReturn {
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

export const AvatarDownload = {
  AvatarDownloadJob,
  addAvatarDownloadJob,
};
