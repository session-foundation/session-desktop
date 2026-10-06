import { UnsupportedMessageData } from '../../data/unsupportedMessage/unsupportedMessage';
import { Data } from '../../data/data';
import { SignalService } from '../../protobuf';
import { innerHandleSwarmContentMessage } from '../../receiver/contentMessage';
import { NetworkTime } from '../../util/NetworkTime';
import {
  MetaGroupWrapperActions,
  MultiEncryptWrapperActions,
} from '../../webworker/workers/browser/libsession_worker_interface';
import ProBackendAPI from '../apis/pro_backend_api/ProBackendAPI';
import { buildSwarmDecodedEnvelope } from '../apis/snode_api/swarmPolling';
import { ConvoHub } from '../conversations';
import { PubKey } from '../types';
import { UserUtils } from '../utils';
import { isNewerFormatData, isUnknownTypeContent } from './detection';
import { currentUnsupportedMessageVersion } from './UnsupportedMessages';
import type { UnsupportedMessageRow } from './types';

type ReprocessResult = 'replaced' | 'stillUnsupported' | 'dropped';

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

async function reprocessRow(row: UnsupportedMessageRow, version: string): Promise<ReprocessResult> {
  // no legacy version will ever decrypt these: only an importer with the newer protocol can
  if (isNewerFormatData(row.data)) {
    await UnsupportedMessageData.setUnsupportedMessageAttemptVersion(row.id, version);
    return 'stillUnsupported';
  }

  let decrypted: Awaited<ReturnType<typeof decryptRecord>>;
  try {
    decrypted = await decryptRecord(row);
    const plaintext = decrypted?.decodedEnvelope?.contentPlaintextUnpadded;
    if (!decrypted || !plaintext?.length) {
      throw new Error('could not decrypt');
    }
    const content = SignalService.Content.decode(plaintext);
    if (isUnknownTypeContent(content, plaintext)) {
      await UnsupportedMessageData.setUnsupportedMessageAttemptVersion(row.id, version);
      return 'stillUnsupported';
    }
  } catch (e) {
    // This version can't process it either and never will (eg. the group keys are gone), so stop
    // retaining the bytes but leave the placeholder as a permanent "can't be displayed".
    window.log.info(`UnsupportedMessages: dropping retained ${row.hash}: ${e.message}`);
    await UnsupportedMessageData.removeUnsupportedMessageById(row.id);
    return 'dropped';
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

  await innerHandleSwarmContentMessage({
    decodedEnvelope: buildSwarmDecodedEnvelope({
      decrypted,
      groupPk: PubKey.is03Pubkey(row.swarm_public_key) ? row.swarm_public_key : null,
      swarmOrigin: {
        swarmPublicKey: row.swarm_public_key,
        namespace: row.namespace,
        rawData: row.data,
        storedAtMs: row.server_timestamp_ms,
      },
      messageExpirationFromRetrieve: row.server_expiry_ms,
      replayedPlaceholder: { wasRead },
    }),
  });
  return 'replaced';
}

let running: Promise<void> | null = null;

/**
 * Replays every retained message the current version hasn't tried yet, so a type added by an update
 * replaces its placeholder in place. Version-gated, so an unchanged app never retries.
 *
 * `doAppStartUp` can run more than once per process, hence the single-flight.
 */
export async function reprocessUnsupportedMessagesOnStartup() {
  if (running) {
    return running;
  }
  running = (async () => {
    try {
      await UnsupportedMessageData.enforceUnsupportedMessageLimits(NetworkTime.now());
      const version = currentUnsupportedMessageVersion();
      const rows = await UnsupportedMessageData.getUnsupportedMessagesToReprocess(version);
      if (!rows.length) {
        return;
      }
      const counts: Record<ReprocessResult, number> = {
        replaced: 0,
        stillUnsupported: 0,
        dropped: 0,
      };
      for (let index = 0; index < rows.length; index++) {
        // eslint-disable-next-line no-await-in-loop
        counts[await reprocessRow(rows[index], version)]++;
      }
      window.log.info(
        `UnsupportedMessages: reprocessed ${rows.length} retained message(s): ${JSON.stringify(counts)}`
      );
    } catch (e) {
      window.log.warn('UnsupportedMessages: reprocessing failed: ', e.message);
    } finally {
      running = null;
    }
  })();
  return running;
}
