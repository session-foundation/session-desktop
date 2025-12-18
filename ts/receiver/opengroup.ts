import { isNil } from 'lodash';
import {
  createPublicMessageSentFromNotUs,
  createPublicMessageSentFromUs,
} from '../models/messageFactory';
import { SignalService } from '../protobuf';
import {
  getCachedNakedKeyFromBlindedNoServerPubkey,
  isUsAnySogsFromCache,
} from '../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { getOpenGroupV2ConversationId } from '../session/apis/open_group_api/utils/OpenGroupUtils';
import { ConvoHub } from '../session/conversations';
import { cleanIncomingDataMessage, messageHasVisibleContent } from './dataMessage';
import { handleMessageJob, toRegularMessage } from './queuedJob';
import { OpenGroupRequestCommonType } from '../data/types';
import { shouldProcessContentMessage } from './common';
import { longOrNumberToNumber } from '../types/long/longOrNumberToNumber';
import type { SogsDecodedEnvelope } from './types';
import { ProfileManager } from '../session/profile_manager/ProfileManager';
import { buildPrivateProfileChangeFromSwarmDataMessage } from '../models/profile';
import { ConversationTypeEnum } from '../models/types';

/**
 * Common checks and decoding that takes place for both v2 and v4 message types.
 */
export const handleOpenGroupMessage = async ({
  decodedContent,
  decodedEnvelope,
  roomInfos,
}: {
  roomInfos: OpenGroupRequestCommonType;
  decodedEnvelope: SogsDecodedEnvelope;
  decodedContent: SignalService.Content;
}) => {
  const { serverUrl, roomId } = roomInfos;
  if (
    !decodedContent ||
    !decodedEnvelope.sentAtMs ||
    !decodedEnvelope.getAuthor() ||
    isNil(decodedEnvelope.serverId)
  ) {
    window?.log?.warn('Invalid data passed to handleOpenGroupV2Message.');
    return;
  }

  if (
    !shouldProcessContentMessage({
      sentAtMs: decodedEnvelope.sentAtMs,
      sigTimestampMs: longOrNumberToNumber(decodedContent.sigTimestamp),
      isCommunity: true,
    })
  ) {
    window?.log?.info(
      'sogs message: shouldProcessContentMessage is false for message sentAt:',
      decodedEnvelope.sentAtMs
    );
    return;
  }

  const conversationId = getOpenGroupV2ConversationId(serverUrl, roomId);
  if (!conversationId) {
    window?.log?.error('We cannot handle a message without a conversationId');
    return;
  }
  const idataMessage = decodedContent?.dataMessage;
  if (!idataMessage) {
    window?.log?.error('Invalid decoded opengroup message: no dataMessage');
    return;
  }

  if (!messageHasVisibleContent(idataMessage as SignalService.DataMessage)) {
    window.log.info('received an empty message for sogs');
    return;
  }

  if (!ConvoHub.use().get(conversationId)?.isOpenGroupV2()) {
    window?.log?.error('Received a message for an unknown convo or not an v2. Skipping');
    return;
  }

  const communityConvo = ConvoHub.use().get(conversationId);

  if (!communityConvo) {
    window?.log?.warn('Skipping handleJob for unknown convo: ', conversationId);
    return;
  }

  void communityConvo.queueJob(async () => {
    const isMe = isUsAnySogsFromCache(decodedEnvelope.getAuthor());

    // this timestamp has already been forced to ms by the handleMessagesResponseV4() function
    const commonAttributes = {
      serverTimestamp: decodedEnvelope.sentAtMs,
      serverId: decodedEnvelope.serverId,
      conversationId,
    };
    const attributesForNotUs = { ...commonAttributes, sender: decodedEnvelope.getAuthor() };
    // those lines just create an empty message only in-memory with some basic stuff set.
    // the whole decoding of data is happening in handleMessageJob()
    const msgModel = isMe
      ? createPublicMessageSentFromUs(commonAttributes)
      : createPublicMessageSentFromNotUs(attributesForNotUs);

    const cleanedDataMessage = cleanIncomingDataMessage(
      decodedContent?.dataMessage as SignalService.DataMessage
    );
    const potentiallyBlindedSender = decodedEnvelope.getAuthor();
    const potentiallyUnblinded =
      getCachedNakedKeyFromBlindedNoServerPubkey(potentiallyBlindedSender) ??
      potentiallyBlindedSender;
    const sendingDeviceConversation = await ConvoHub.use().getOrCreateAndWait(
      getCachedNakedKeyFromBlindedNoServerPubkey(potentiallyBlindedSender) ?? potentiallyUnblinded,
      ConversationTypeEnum.PRIVATE
    );

    // Check if we need to update any profile names
    if (!isMe) {
      const profile = buildPrivateProfileChangeFromSwarmDataMessage({
        convo: sendingDeviceConversation,
        dataMessage: cleanedDataMessage,
        decodedPro: decodedEnvelope.validPro,
      });
      if (profile) {
        await ProfileManager.updateProfileOfContact(profile);
      }
    }

    // Note: deduplication is made in filterDuplicatesFromDbAndIncoming now

    await handleMessageJob(
      msgModel,
      communityConvo,
      toRegularMessage(cleanedDataMessage),
      decodedEnvelope
    );
  });
};
