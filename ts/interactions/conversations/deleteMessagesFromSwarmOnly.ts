import { compact } from 'lodash';
import type { MessageModel } from '../../models/message';
import { SnodeAPI } from '../../session/apis/snode_api/SNodeAPI';
import { PubKey } from '../../session/types';
import { ed25519Str } from '../../session/utils/String';
import { isStringArray } from '../../types/isStringArray';
import type { ConversationModel } from '../../models/conversation';
import { UserUtils } from '../../session/utils';

/**
 * Do a single request to the swarm with all the message hashes to delete from the swarm.
 * Does not delete anything locally.
 * Should only be used when we are deleting a
 *
 * Returns true if no errors happened, false in an error happened
 */
export async function deleteMessagesFromSwarmOnly(
  conversation: ConversationModel,
  messages: Array<MessageModel> | Array<string>
) {
  const us = UserUtils.getOurPubKeyStrFromCache();

  // legacy groups are deprecated
  if (conversation.isClosedGroup() && PubKey.is05Pubkey(conversation.id)) {
    throw new Error('legacy groups are deprecated. Not deleting anything');
  }
  if (conversation.isPrivateAndBlinded()) {
    throw new Error(`deleteMessagesFromSwarmOnly does not support blinded conversations`);
  }

  const pubkeyToDeleteFrom = PubKey.is03Pubkey(conversation.id) ? conversation.id : us;
  if (!PubKey.is03Pubkey(pubkeyToDeleteFrom) && !PubKey.is05Pubkey(pubkeyToDeleteFrom)) {
    throw new Error(`deleteMessagesFromSwarmOnly needs a 03 or 05 pk`);
  }
  if (PubKey.is05Pubkey(pubkeyToDeleteFrom) && pubkeyToDeleteFrom !== us) {
    throw new Error(`deleteMessagesFromSwarmOnly with 05 pk can only delete for ourself`);
  }

  const hashesToDelete = isStringArray(messages)
    ? messages
    : compact(messages.map(m => m.getMessageHash()));

  try {
    // Legacy groups are handled above
    // We are deleting from a swarm, so this is not a sogs.
    // This means that the target here can only be the 03 group pubkey, or our own swarm pubkey.

    // If this is a private chat, we can only delete messages on our own swarm only, so use our "side" of the conversation
    if (!hashesToDelete.length) {
      window.log?.warn('deleteMessagesFromSwarmOnly: no hashes to delete');
      return true;
    }

    window.log.debug(
      `deleteMessagesFromSwarmOnly: Deleting from swarm of  ${ed25519Str(pubkeyToDeleteFrom)}, hashes: ${hashesToDelete}`
    );

    const hashesAsSet = new Set(hashesToDelete);
    if (PubKey.is03Pubkey(pubkeyToDeleteFrom)) {
      return await SnodeAPI.networkDeleteMessagesForGroup(hashesAsSet, pubkeyToDeleteFrom);
    }
    const deletedFromSwarm = await SnodeAPI.networkDeleteMessageOurSwarm(
      hashesAsSet,
      pubkeyToDeleteFrom
    );
    if (!deletedFromSwarm) {
      window.log.warn(
        `deleteMessagesFromSwarmOnly: some messages failed to be deleted from swarm of ${ed25519Str(pubkeyToDeleteFrom)}. Maybe they were already deleted?`
      );
    }

    return deletedFromSwarm;
  } catch (e) {
    window.log?.error(
      `deleteMessagesFromSwarmOnly: Error deleting message from swarm of ${ed25519Str(pubkeyToDeleteFrom)}, hashesToDelete length: ${hashesToDelete.length}`,
      e
    );
    window.log.debug('deleteMessagesFromSwarmOnly: hashesToDelete', hashesToDelete);
    return false;
  }
}
