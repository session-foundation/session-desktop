import { omit } from 'lodash';
import { UnsupportedMessageData } from '../../data/unsupportedMessage/unsupportedMessage';
import { Data } from '../../data/data';
import { SignalService } from '../../protobuf';
import { innerHandleSwarmContentMessage } from '../../receiver/contentMessage';
import { NetworkTime } from '../../util/NetworkTime';
import type { SwarmDecodedEnvelope } from '../../receiver/types';
import {
  MetaGroupWrapperActions,
  MultiEncryptWrapperActions,
} from '../../webworker/workers/browser/libsession_worker_interface';
import ProBackendAPI from '../apis/pro_backend_api/ProBackendAPI';
import { buildSwarmDecodedEnvelope } from '../apis/snode_api/swarmPolling';
import { ConvoHub } from '../conversations';
import { PubKey } from '../types';
import { UserUtils } from '../utils';
import { isUnknownTypeContent } from './detection';
import {
  afterSendExpiryFromContent,
  currentUnsupportedMessageVersion,
  retainedExpiryMs,
} from './UnsupportedMessages';
import { UNSUPPORTED_MESSAGE_REPLAY_PAGE_SIZE, type UnsupportedMessageRow } from './types';

type ReprocessResult = 'replaced' | 'stillUnsupported' | 'failed';

async function decryptRecord(row: UnsupportedMessageRow) {
  const toDecrypt = [{ envelopePayload: row.data, messageHash: row.hash }];
  const proBackendPubkeyHex = ProBackendAPI.getServer().server.edPkHex;

  if (PubKey.is03Pubkey(row.swarm_public_key)) {
    const groupEncKeys = await MetaGroupWrapperActions.keyGetAll(row.swarm_public_key);
    if (!groupEncKeys.length) {
      return null;
    }
    const [decrypted] = await MultiEncryptWrapperActions.decryptForGroup(toDecrypt, {
      proBackendPubkeyHex,
      ed25519GroupPubkeyHex: row.swarm_public_key,
      groupEncKeys,
    });
    return decrypted ?? null;
  }

  const ed25519PrivateKeyHex = (await UserUtils.getUserED25519KeyPair()).privKey.slice(0, 64);
  const [decrypted] = await MultiEncryptWrapperActions.decryptFor1o1(toDecrypt, {
    proBackendPubkeyHex,
    ed25519PrivateKeyHex,
  });
  return decrypted ?? null;
}

function describeError(e: unknown) {
  return e instanceof Error ? `${e.name}: ${e.message}` : 'unknown error';
}

/**
 * Whether to verify, after replaying `content`, that a message row landed (findable by sender and sent
 * timestamp). Every row is replayed regardless: this only decides whether a dropped replay can be told
 * apart from a handled one, which the handlers can't report as they swallow their own errors.
 *
 * Control-type content (reactions, group updates) never lands as such a row, so it is never verified.
 * Call, data-extraction, receipt and similar content can never be in the table at all: the receive
 * path only retains a message when no known type in it is usable (`hasValidKnownContent`).
 */
function shouldCheckReplayLanded(content: SignalService.Content) {
  return (
    !!content.dataMessage &&
    !content.dataMessage.reaction &&
    !content.dataMessage.groupUpdateMessage
  );
}

/**
 * Message saves are queued per conversation and not awaited by the receive path, so wait for the queue
 * of the conversation the replay was added to before looking for it.
 */
async function replayedMessageLanded({
  decodedEnvelope,
  content,
}: {
  decodedEnvelope: SwarmDecodedEnvelope;
  content: SignalService.Content;
}) {
  const conversationId = content.dataMessage?.syncTarget || decodedEnvelope.source;
  const convo = ConvoHub.use().get(conversationId);
  if (convo) {
    await convo.queueJob(async () => {});
  }
  const found = await Data.getMessagesBySenderAndSentAt([
    { source: decodedEnvelope.getAuthor(), timestamp: decodedEnvelope.sentAtMs },
  ]);
  return !!found?.length;
}

export async function reprocessRow(
  row: UnsupportedMessageRow,
  version: string
): Promise<ReprocessResult> {
  // Decided by kind, never by the bytes: group data is encrypted with a random nonce first, so it can
  // start with the newer-format prefix too.
  // No legacy version will ever decrypt a newerFormat row: only an importer with the newer protocol can.
  if (row.kind === 'newerFormat') {
    await UnsupportedMessageData.setUnsupportedMessageAttemptVersion(row.id, version);
    return 'stillUnsupported';
  }

  let decrypted: NonNullable<Awaited<ReturnType<typeof decryptRecord>>>;
  let content: SignalService.Content;
  try {
    const result = await decryptRecord(row);
    const plaintext = result?.decodedEnvelope?.contentPlaintextUnpadded;
    if (!result || !plaintext?.length) {
      throw new Error('could not decrypt');
    }
    decrypted = result;
    content = SignalService.Content.decode(plaintext);
    if (isUnknownTypeContent(content, plaintext)) {
      await UnsupportedMessageData.setUnsupportedMessageAttemptVersion(row.id, version);
      return 'stillUnsupported';
    }
  } catch (e) {
    // Kept: a later version may manage it (eg. after a fix), and the byte budget still bounds it.
    window.log.info(`UnsupportedMessages: failed to reprocess ${row.hash}: ${describeError(e)}`);
    await UnsupportedMessageData.setUnsupportedMessageAttemptVersion(row.id, version);
    return 'failed';
  }

  let wasRead = false;
  if (row.placeholder_message_id) {
    const placeholder = await Data.getMessageById(row.placeholder_message_id);
    if (placeholder) {
      wasRead = !placeholder.isUnread();
      // The replay has the same sender and sent timestamp, so it would be dropped as a duplicate of its
      // own placeholder if that were still there. It also takes the placeholder's position.
      const convo = ConvoHub.use().get(placeholder.get('conversationId'));
      if (convo) {
        await convo.removeMessage(placeholder.id);
      } else {
        await Data.removeMessage(placeholder.id);
      }
    }
  }
  await UnsupportedMessageData.removeUnsupportedMessageById(row.id);

  const decodedEnvelope = buildSwarmDecodedEnvelope({
    decrypted,
    groupPk: PubKey.is03Pubkey(row.swarm_public_key) ? row.swarm_public_key : null,
    swarmOrigin: {
      swarmPublicKey: row.swarm_public_key,
      namespace: row.namespace,
      rawData: row.data,
      storedAtMs: row.server_timestamp_ms,
    },
    messageExpirationFromRetrieve: row.server_expiry_ms,
    // a replayed message is old, so it never notifies
    replayedPlaceholder: { wasRead },
  });

  let landed = false;
  try {
    await innerHandleSwarmContentMessage({ decodedEnvelope });
    landed =
      !shouldCheckReplayLanded(content) ||
      (await replayedMessageLanded({ decodedEnvelope, content }));
  } catch (e) {
    window.log.info(`UnsupportedMessages: replay of ${row.hash} threw: ${describeError(e)}`);
  }
  if (landed) {
    return 'replaced';
  }

  // The placeholder is already gone, so the record goes back without one, and a later version retries it.
  window.log.info(`UnsupportedMessages: replay of ${row.hash} was dropped, retaining it again`);
  await UnsupportedMessageData.insertUnsupportedMessage({
    ...omit(row, 'id'),
    placeholder_message_id: null,
    expires_at_ms: retainedExpiryMs({
      afterSendExpiresAtMs: afterSendExpiryFromContent(content, decodedEnvelope.sentAtMs),
      serverTimestampMs: row.server_timestamp_ms,
      serverExpiryMs: row.server_expiry_ms,
    }),
    last_attempt_version: version,
  });
  return 'failed';
}

let running: Promise<void> | null = null;

async function enforceLimits() {
  try {
    await UnsupportedMessageData.enforceUnsupportedMessageLimits(NetworkTime.now());
  } catch (e) {
    window.log.warn(`UnsupportedMessages: enforcing the limits failed: ${describeError(e)}`);
  }
}

async function reprocess() {
  try {
    const version = currentUnsupportedMessageVersion();
    const counts: Record<ReprocessResult, number> = {
      replaced: 0,
      stillUnsupported: 0,
      failed: 0,
    };
    // Never loaded: no legacy version can decrypt them, and they can be large.
    counts.stillUnsupported +=
      await UnsupportedMessageData.markNewerFormatUnsupportedMessagesAttempted(version);

    // Paged by id so a row the replay neither stamps nor removes can't be fetched again forever.
    let afterId = 0;
    let page: Array<UnsupportedMessageRow>;
    do {
      // eslint-disable-next-line no-await-in-loop
      page = await UnsupportedMessageData.getUnknownTypeUnsupportedMessagesToReprocess(
        version,
        afterId,
        UNSUPPORTED_MESSAGE_REPLAY_PAGE_SIZE
      );
      for (let index = 0; index < page.length; index++) {
        // eslint-disable-next-line no-await-in-loop
        counts[await reprocessRow(page[index], version)]++;
      }
      afterId = page.length ? page[page.length - 1].id : afterId;
    } while (page.length === UNSUPPORTED_MESSAGE_REPLAY_PAGE_SIZE);

    if (counts.replaced || counts.stillUnsupported || counts.failed) {
      window.log.info(
        `UnsupportedMessages: reprocessed retained messages: ${JSON.stringify(counts)}`
      );
    }
  } catch (e) {
    window.log.warn(`UnsupportedMessages: reprocessing failed: ${describeError(e)}`);
  }
}

/**
 * Removes expired records, applies the byte budget, then replays every retained message the current
 * version hasn't tried yet, so a type added by an update replaces its placeholder in place.
 * Version-gated, so repeating it on an unchanged app only costs the limit check and two queries.
 *
 * Must only be called once the group keys are loaded: a group message replayed without them fails, and
 * a failure is not retried until the next version.
 *
 * Single-flight, as startup can run more than once per process.
 */
export async function runUnsupportedMessageMaintenance() {
  if (running) {
    return running;
  }
  running = (async () => {
    try {
      await enforceLimits();
      await reprocess();
    } finally {
      running = null;
    }
  })();
  return running;
}
