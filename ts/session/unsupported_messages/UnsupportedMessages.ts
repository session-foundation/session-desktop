import { isEmpty } from 'lodash';
import { UnsupportedMessageData } from '../../data/unsupportedMessage/unsupportedMessage';
import type { ConversationModel } from '../../models/conversation';
import {
  createSwarmMessageSentFromNotUs,
  createSwarmMessageSentFromUs,
} from '../../models/messageFactory';
import { SignalService } from '../../protobuf';
import type { SwarmDecodedEnvelope, SwarmOrigin } from '../../receiver/types';
import { NetworkTime } from '../../util/NetworkTime';
import { TTL_DEFAULT } from '../constants';
import { ConvoHub } from '../conversations';
import { DisappearingMessages } from '../disappearing_messages';
import { PubKey } from '../types';
import { UserUtils } from '../utils';
import { ed25519Str } from '../utils/String';
import { recordUnsupportedBannerTrigger } from './banner';
import type { UnsupportedMessageInsert } from './types';

type Placement = 'none' | 'incoming' | 'outgoing';

export function currentUnsupportedMessageVersion() {
  return window.getVersion();
}

/**
 * When a retained message has no placeholder there is nothing else to own its expiry, so work out when
 * the record itself should go.
 */
export function retainedExpiryMs({
  afterSendExpiresAtMs,
  serverTimestampMs,
  serverExpiryMs,
}: {
  afterSendExpiresAtMs: number | null;
  serverTimestampMs: number;
  serverExpiryMs: number | null;
}): number | null {
  // Disappear-after-read can never start, as the message is never shown, so only after-send is usable.
  if (afterSendExpiresAtMs !== null) {
    return afterSendExpiresAtMs;
  }
  // After-send messages are stored with a TTL matching their timer, so a swarm expiry shorter than the
  // default TTL is the only other signal that the message was meant to disappear.
  if (serverExpiryMs !== null && serverExpiryMs - serverTimestampMs < TTL_DEFAULT.CONTENT_MESSAGE) {
    return serverExpiryMs;
  }
  return null;
}

export function afterSendExpiryFromContent(content: SignalService.Content, sentAtMs: number) {
  const timerSeconds = content.expirationTimer ?? 0;
  if (
    content.expirationType === SignalService.Content.ExpirationType.DELETE_AFTER_SEND &&
    timerSeconds > 0
  ) {
    return sentAtMs + timerSeconds * 1000;
  }
  return null;
}

export function unknownTypePlacement({
  isGroupMessage,
  isFromUs,
  author,
  groupPk,
  syncTarget,
}: {
  isGroupMessage: boolean;
  isFromUs: boolean;
  author: string;
  groupPk: string;
  syncTarget: string | null | undefined;
}): { placement: Placement; threadId: string | null } {
  if (isGroupMessage) {
    return { placement: isFromUs ? 'outgoing' : 'incoming', threadId: groupPk };
  }
  if (!isFromUs) {
    return { placement: 'incoming', threadId: author };
  }
  if (syncTarget && PubKey.is05Pubkey(syncTarget)) {
    return { placement: 'outgoing', threadId: syncTarget };
  }
  return { placement: 'none', threadId: null };
}

function buildRecord({
  kind,
  origin,
  hash,
  sender,
  sentTimestampMs,
  serverExpiryMs,
  expiresAtMs,
  nowMs,
}: {
  kind: UnsupportedMessageInsert['kind'];
  origin: SwarmOrigin;
  hash: string;
  sender: string | null;
  sentTimestampMs: number | null;
  serverExpiryMs: number | null;
  expiresAtMs: number | null;
  nowMs: number;
}): UnsupportedMessageInsert {
  return {
    kind,
    swarm_public_key: origin.swarmPublicKey,
    namespace: origin.namespace,
    hash,
    sender,
    sent_timestamp_ms: sentTimestampMs,
    server_timestamp_ms: origin.storedAtMs,
    server_expiry_ms: serverExpiryMs,
    data: origin.rawData,
    placeholder_message_id: null,
    expires_at_ms: expiresAtMs,
    received_at_ms: nowMs,
    last_attempt_version: currentUnsupportedMessageVersion(),
  };
}

async function handleNewerFormatMessage({
  hash,
  expirationMs,
  ...origin
}: SwarmOrigin & { hash: string; expirationMs: number }) {
  const nowMs = NetworkTime.now();
  const inserted = await UnsupportedMessageData.insertUnsupportedMessage(
    buildRecord({
      kind: 'newerFormat',
      origin,
      hash,
      // the sender is inside the encrypted payload, and the prefix is unauthenticated
      sender: null,
      sentTimestampMs: null,
      serverExpiryMs: expirationMs,
      expiresAtMs: retainedExpiryMs({
        afterSendExpiresAtMs: null,
        serverTimestampMs: origin.storedAtMs,
        serverExpiryMs: expirationMs,
      }),
      nowMs,
    }),
    nowMs
  );
  window.log.info(
    `UnsupportedMessages: newer format message ${hash} (${origin.rawData.length} bytes), retained: ${inserted}`
  );
  if (inserted) {
    await recordUnsupportedBannerTrigger('newerFormat', nowMs);
  }
}

/**
 * Only an existing, active and not hidden conversation gets a placeholder: something we can't show must
 * never be what creates, activates or un-hides a conversation or a message request.
 */
function conversationForPlaceholder(threadId: string | null): ConversationModel | null {
  if (!threadId) {
    return null;
  }
  const convo = ConvoHub.use().get(threadId);
  if (!convo || !convo.isActive() || convo.isHidden()) {
    return null;
  }
  return convo;
}

async function addPlaceholder({
  convo,
  decodedEnvelope,
  content,
  placement,
  expiresAtMsWithoutPlaceholder,
}: {
  convo: ConversationModel;
  decodedEnvelope: SwarmDecodedEnvelope;
  content: SignalService.Content;
  placement: Exclude<Placement, 'none'>;
  expiresAtMsWithoutPlaceholder: number | null;
}) {
  // The conversation was checked before this job was queued, and may have been hidden or deleted since.
  // `setActiveAt` below would otherwise re-activate it.
  if (conversationForPlaceholder(convo.id) !== convo) {
    window.log.info(
      `UnsupportedMessages: ${decodedEnvelope.messageHash} not placed, convo ${ed25519Str(convo.id)} is no longer visible`
    );
    await UnsupportedMessageData.setUnsupportedMessageExpiry(
      decodedEnvelope.messageHash,
      expiresAtMsWithoutPlaceholder
    );
    return;
  }

  const shared = {
    conversationId: convo.id,
    messageHash: decodedEnvelope.messageHash,
    sentAt: decodedEnvelope.sentAtMs,
  };
  let msgModel =
    placement === 'outgoing'
      ? createSwarmMessageSentFromUs(shared)
      : createSwarmMessageSentFromNotUs({ ...shared, sender: decodedEnvelope.getAuthor() });
  msgModel.set({ unsupportedMessage: true });

  // The disappearing settings are known Content fields even when the type isn't, so the placeholder
  // goes through the normal disappearing path and owns the expiry.
  const expireUpdate = await DisappearingMessages.checkForExpireUpdateInContentMessage(
    content,
    convo,
    decodedEnvelope.messageExpirationFromRetrieve
  );
  if (!isEmpty(expireUpdate)) {
    msgModel = DisappearingMessages.getMessageReadyToDisappear(convo, msgModel, 0, expireUpdate);
  }

  const id = await msgModel.commit();
  msgModel.setId(id);
  await UnsupportedMessageData.setUnsupportedMessagePlaceholder(decodedEnvelope.messageHash, id);

  convo.setActiveAt(Math.max(convo.getActiveAt() || 0, msgModel.get('sent_at') || 0));
  convo.updateLastMessage();
  await convo.commit();

  if (msgModel.get('unread')) {
    convo.throttledNotify(msgModel);
  }
}

/**
 * Called once the receive path has decided a Content is an unknown type (see `isUnknownTypeContent`)
 * and has applied its usual blocked/dropped checks.
 */
async function handleUnknownTypeMessage(
  decodedEnvelope: SwarmDecodedEnvelope,
  content: SignalService.Content
) {
  const origin = decodedEnvelope.swarmOrigin;
  if (!origin) {
    throw new Error('handleUnknownTypeMessage: a swarm origin is required');
  }
  const author = decodedEnvelope.getAuthor();
  const isFromUs = UserUtils.isUsFromCache(author);
  const { placement, threadId } = unknownTypePlacement({
    isGroupMessage: !!decodedEnvelope.senderIdentity && PubKey.is03Pubkey(decodedEnvelope.source),
    isFromUs,
    author,
    groupPk: decodedEnvelope.source,
    syncTarget: content.dataMessage?.syncTarget,
  });
  const convo = placement === 'none' ? null : conversationForPlaceholder(threadId);
  const nowMs = NetworkTime.now();
  const expiresAtMsWithoutPlaceholder = retainedExpiryMs({
    afterSendExpiresAtMs: afterSendExpiryFromContent(content, decodedEnvelope.sentAtMs),
    serverTimestampMs: origin.storedAtMs,
    serverExpiryMs: decodedEnvelope.messageExpirationFromRetrieve,
  });

  const inserted = await UnsupportedMessageData.insertUnsupportedMessage(
    buildRecord({
      kind: 'unknownType',
      origin,
      hash: decodedEnvelope.messageHash,
      sender: author,
      sentTimestampMs: decodedEnvelope.sentAtMs,
      serverExpiryMs: decodedEnvelope.messageExpirationFromRetrieve,
      expiresAtMs: convo ? null : expiresAtMsWithoutPlaceholder,
      nowMs,
    }),
    nowMs
  );
  window.log.info(
    `UnsupportedMessages: unknown type message ${decodedEnvelope.messageHash} (${origin.rawData.length} bytes) placement: ${placement}, convo: ${convo ? ed25519Str(convo.id) : 'none'}, retained: ${inserted}`
  );
  if (!inserted) {
    return;
  }

  if (convo && placement !== 'none') {
    await convo.queueJob(async () =>
      addPlaceholder({
        convo,
        decodedEnvelope,
        content,
        placement,
        expiresAtMsWithoutPlaceholder,
      })
    );
    return;
  }

  // An unknown type from someone else either has a bubble or came from a stranger, and a stranger must
  // not be able to raise an account-level notice with it.
  if (placement === 'none' && isFromUs) {
    await recordUnsupportedBannerTrigger('otherDevice', nowMs);
  }
}

export const UnsupportedMessages = {
  handleNewerFormatMessage,
  handleUnknownTypeMessage,
};
