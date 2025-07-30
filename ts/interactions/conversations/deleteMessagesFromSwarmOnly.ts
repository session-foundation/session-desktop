import type { PubkeyType, GroupPubkeyType } from 'libsession_util_nodejs';
import { compact, isEmpty } from 'lodash';
import type { MessageModel } from '../../models/message';
import { SnodeAPI } from '../../session/apis/snode_api/SNodeAPI';
import { PubKey } from '../../session/types';
import { ed25519Str } from '../../session/utils/String';
import { isStringArray } from '../../types/isStringArray';

/**
 * Do a single request to the swarm with all the message hashes to delete from the swarm.
 * Does not delete anything locally.
 * Should only be used when we are deleting a
 *
 * Returns true if no errors happened, false in an error happened
 */
export async function deleteMessagesFromSwarmOnly(
  messages: Array<MessageModel> | Array<string>,
  pubkey: PubkeyType | GroupPubkeyType
) {
  const deletionMessageHashes = isStringArray(messages)
    ? messages
    : compact(messages.map(m => m.getMessageHash()));

  try {
    if (isEmpty(messages)) {
      return false;
    }

    if (!deletionMessageHashes.length) {
      window.log?.warn(
        'deleteMessagesFromSwarmOnly: We do not have hashes for some of those messages'
      );
      return false;
    }
    const hashesAsSet = new Set(deletionMessageHashes);
    if (PubKey.is03Pubkey(pubkey)) {
      return await SnodeAPI.networkDeleteMessagesForGroup(hashesAsSet, pubkey);
    }
    return await SnodeAPI.networkDeleteMessageOurSwarm(hashesAsSet, pubkey);
  } catch (e) {
    window.log?.error(
      `deleteMessagesFromSwarmOnly: Error deleting message from swarm of ${ed25519Str(pubkey)}, hashes: ${deletionMessageHashes}`,
      e
    );
    return false;
  }
}
