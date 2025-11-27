import { isEmpty, isNumber } from 'lodash';
import { SignalService } from '../../../protobuf';
import { UserSyncJobDone } from '../../../shims/events';

import { DisappearingMessageUpdate } from '../../disappearing_messages/types';
import { ExpirationTimerUpdateMessage } from '../../messages/outgoing/controlMessage/ExpirationTimerUpdateMessage';
import { MessageRequestResponse } from '../../messages/outgoing/controlMessage/MessageRequestResponse';
import { UnsendMessage } from '../../messages/outgoing/controlMessage/UnsendMessage';
import {
  AttachmentPointerWithUrl,
  PreviewWithAttachmentUrl,
  Quote,
  VisibleMessage,
} from '../../messages/outgoing/visibleMessage/VisibleMessage';
import { UserSync } from '../job_runners/jobs/UserSyncJob';
import { longOrNumberToNumber } from '../../../types/long/longOrNumberToNumber';

export const forceSyncConfigurationNowIfNeeded = async (waitForMessageSent = false) => {
  return new Promise(resolve => {
    // if we hang for more than 20sec, force resolve this promise.
    setTimeout(() => {
      resolve(false);
    }, 20000);

    // the UserSync also handles dumping in to the DB if we do not need to push the data, but the dumping needs to be done even before the feature flag is true.
    void UserSync.queueNewJobIfNeeded().catch(e => {
      window.log.warn(
        'forceSyncConfigurationNowIfNeeded scheduling of jobs UserSync.queueNewJobIfNeeded failed with: ',
        e.message
      );
    });

    if (waitForMessageSent) {
      window.Whisper.events.once(UserSyncJobDone, () => {
        resolve(true);
      });
      return;
    }
    resolve(true);
  });
};

const buildSyncVisibleMessage = (
  identifier: string,
  dataMessage: SignalService.DataMessage,
  createAtNetworkTimestamp: number,
  syncTarget: string,
  expireUpdate: DisappearingMessageUpdate,
  proMessage: SignalService.ProMessage | null | undefined
) => {
  const body = dataMessage.body || undefined;

  const wrapToUInt8Array = (buffer: any) => {
    if (!buffer) {
      return undefined;
    }
    if (buffer instanceof Uint8Array) {
      // Audio messages are already uint8Array
      return buffer;
    }
    return new Uint8Array(buffer.toArrayBuffer());
  };
  const attachments = (dataMessage.attachments || []).map(attachment => {
    const key = wrapToUInt8Array(attachment.key);
    const digest = wrapToUInt8Array(attachment.digest);

    return {
      ...attachment,
      key,
      digest,
    };
  }) as Array<AttachmentPointerWithUrl>;
  const quote = (dataMessage.quote as Quote) || undefined;
  const preview = (dataMessage.preview as Array<PreviewWithAttachmentUrl>) || [];

  return new VisibleMessage({
    identifier,
    createAtNetworkTimestamp,
    attachments,
    body,
    quote,
    preview,
    userProfile: null, // this is a synced message, so we do not need to include the userProfile
    syncTarget,
    expireTimer: expireUpdate.expirationTimer,
    expirationType: expireUpdate.expirationType,
    outgoingProMessageDetails: proMessage ?? null,
  });
};

const buildSyncExpireTimerMessage = (
  identifier: string,
  createAtNetworkTimestamp: number,
  expireUpdate: DisappearingMessageUpdate,
  syncTarget: string
) => {
  const { expirationType, expirationTimer: expireTimer } = expireUpdate;

  return new ExpirationTimerUpdateMessage({
    identifier,
    createAtNetworkTimestamp,
    expirationType,
    expireTimer,
    syncTarget,
  });
};

export type SyncMessageType =
  | VisibleMessage
  | ExpirationTimerUpdateMessage
  | MessageRequestResponse
  | UnsendMessage;

export const buildSyncMessage = (
  identifier: string,
  dataMessage: SignalService.DataMessage,
  syncTarget: string,
  sentTimestamp: number,
  expireUpdate: DisappearingMessageUpdate,
  proMessage: SignalService.ProMessage | null | undefined
): VisibleMessage | ExpirationTimerUpdateMessage | null => {
  if (!(dataMessage instanceof SignalService.DataMessage)) {
    throw new Error('buildSyncMessage with something else than a DataMessage');
  }

  if (!sentTimestamp || !isNumber(sentTimestamp)) {
    throw new Error('Tried to build a sync message without a sentTimestamp');
  }
  // don't include our profileKey on syncing message. This is to be done through libsession now
  const timestamp = longOrNumberToNumber(sentTimestamp);

  if (
    dataMessage.flags === SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE &&
    !isEmpty(expireUpdate)
  ) {
    const expireTimerSyncMessage = buildSyncExpireTimerMessage(
      identifier,
      timestamp,
      expireUpdate,
      syncTarget
    );

    return expireTimerSyncMessage;
  }

  const visibleSyncMessage = buildSyncVisibleMessage(
    identifier,
    dataMessage,
    timestamp,
    syncTarget,
    expireUpdate,
    proMessage
  );
  return visibleSyncMessage;
};
