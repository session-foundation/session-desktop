import { v4 as uuid } from 'uuid';

import { SignalService } from '../../../../protobuf';
import { SnodeNamespaces } from '../../../apis/snode_api/namespaces';
import { ConvoHub } from '../../../conversations';
import { DisappearingMessages } from '../../../disappearing_messages';
import { PubKey } from '../../../types';
import { UserUtils } from '../../../utils';
import { ExpirableMessage, ExpirableMessageParams } from '../ExpirableMessage';
import { NetworkTime } from '../../../../util/NetworkTime';
import { MessageQueue } from '../../../sending';

interface DataExtractionNotificationMessageParams extends ExpirableMessageParams {
  referencedAttachmentTimestamp: number;
}

export class DataExtractionNotificationMessage extends ExpirableMessage {
  public readonly referencedAttachmentTimestamp: number;

  constructor(params: DataExtractionNotificationMessageParams) {
    super(params);
    this.referencedAttachmentTimestamp = params.referencedAttachmentTimestamp;
    // this is unused. Probably on all platforms, but well.
    if (!this.referencedAttachmentTimestamp) {
      throw new Error('referencedAttachmentTimestamp must be set');
    }
  }

  public contentProto(): SignalService.Content {
    const content = super.contentProto();
    content.dataExtractionNotification = this.extractionProto();
    return content;
  }

  protected extractionProto(): SignalService.DataExtractionNotification {
    const ACTION_ENUM = SignalService.DataExtractionNotification.Type;

    const action = ACTION_ENUM.MEDIA_SAVED; // we cannot know when user screenshots, so it can only be a media saved on desktop

    return new SignalService.DataExtractionNotification({
      type: action,
      timestamp: this.referencedAttachmentTimestamp,
    });
  }
}

/**
 * Currently only enabled for private chats
 */
export const sendDataExtractionNotification = async (
  conversationId: string,
  attachmentSender: string,
  referencedAttachmentTimestamp: number
) => {
  const convo = ConvoHub.use().get(conversationId);
  if (
    !convo ||
    !convo.isPrivate() ||
    convo.isMe() ||
    convo.isIncomingRequest() ||
    UserUtils.isUsFromCache(attachmentSender) ||
    convo.isBlocked()
  ) {
    window.log.warn('Not sending saving attachment notification for', attachmentSender);
    return;
  }
  const { expirationType, expireTimer } =
    DisappearingMessages.forcedDeleteAfterReadMsgSetting(convo);
  // DataExtractionNotification are expiring with a forced DaR timer if a DaS is set.
  // It's because we want the DataExtractionNotification to stay in the swarm as much as possible,
  // but also expire on the recipient's side (and synced) once read.
  const dataExtractionNotificationMessage = new DataExtractionNotificationMessage({
    referencedAttachmentTimestamp,
    identifier: uuid(),
    createAtNetworkTimestamp: NetworkTime.now(),
    expirationType,
    expireTimer,
  });

  const pubkey = PubKey.cast(conversationId);
  window.log.info(
    `Sending DataExtractionNotification to ${conversationId} about attachment: ${referencedAttachmentTimestamp}`
  );

  try {
    await MessageQueue.use().sendTo1o1NonDurably({
      pubkey,
      message: dataExtractionNotificationMessage,
      namespace: SnodeNamespaces.Default,
    });
  } catch (e) {
    window.log.warn('failed to send data extraction notification', e);
  }
};
