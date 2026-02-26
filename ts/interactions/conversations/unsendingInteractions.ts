import { ConversationModel } from '../../models/conversation';
import { MessageModel } from '../../models/message';
import { PubKey } from '../../session/types';
import { UserUtils } from '../../session/utils';
import { ed25519Str } from '../../session/utils/String';

import { deleteMessagesLocallyOnly } from './deleteMessagesLocallyOnly';
import { deleteMessagesFromSwarmOnly } from './deleteMessagesFromSwarmOnly';

/**
 * Delete the messages (with a valid hash) from the swarm and completely delete the messages locally.
 * Only delete locally if the delete from swarm was successful.
 *
 * Returns true if the delete from swarm was successful, false otherwise.
 */
export async function deleteMessagesFromSwarmAndCompletelyLocally(
  conversation: ConversationModel,
  messages: Array<MessageModel>
) {
  return deleteMessagesFromSwarmShared(conversation, messages, 'complete');
}

/**
 * Delete the messages (with a valid hash) from the swarm.
 * Only mark as deleted if the delete from swarm was successful.
 *
 * Returns true if the delete from swarm was successful, false otherwise.
 *
 */
export async function deleteMessagesFromSwarmAndMarkAsDeletedLocally(
  conversation: ConversationModel,
  messages: Array<MessageModel>
) {
  return deleteMessagesFromSwarmShared(conversation, messages, 'markDeleted');
}

async function deleteMessagesFromSwarmShared(
  conversation: ConversationModel,
  messages: Array<MessageModel>,
  deletionType: 'complete' | 'markDeleted'
) {
  // legacy groups are deprecated
  if (conversation.isClosedGroup() && PubKey.is05Pubkey(conversation.id)) {
    throw new Error('legacy groups are deprecated. Not deleting anything');
  }
  if (conversation.isPrivateAndBlinded()) {
    throw new Error(
      `deleteMessagesFromSwarmShared ${deletionType} does not support blinded conversations`
    );
  }

  // Legacy groups are handled above
  // We are deleting from a swarm, so this is not a sogs.
  // This means that the target here can only be the 03 group pubkey, or our own swarm pubkey.

  // If this is a private chat, we can only delete messages on our own swarm, so use our "side" of the conversation
  const pubkeyToDeleteFrom = PubKey.is03Pubkey(conversation.id)
    ? conversation.id
    : UserUtils.getOurPubKeyStrFromCache();
  if (!PubKey.is03Pubkey(pubkeyToDeleteFrom) && !PubKey.is05Pubkey(pubkeyToDeleteFrom)) {
    throw new Error(`deleteMessagesFromSwarmShared ${deletionType} needs a 03 or 05 pk`);
  }
  if (
    PubKey.is05Pubkey(pubkeyToDeleteFrom) &&
    pubkeyToDeleteFrom !== UserUtils.getOurPubKeyStrFromCache()
  ) {
    throw new Error(
      `deleteMessagesFromSwarmShared ${deletionType} with 05 pk can only delete for ourself`
    );
  }

  window.log.info(
    `deleteMessagesFromSwarmShared ${deletionType}: Deleting from swarm of  ${ed25519Str(pubkeyToDeleteFrom)}, hashes: ${messages.map(m => m.getMessageHash())}`
  );

  const deletedFromSwarm = await deleteMessagesFromSwarmOnly(messages, pubkeyToDeleteFrom);
  if (!deletedFromSwarm) {
    window.log.warn(
      `deleteMessagesFromSwarmShared ${deletionType}: some messages failed to be deleted from swarm of ${ed25519Str(pubkeyToDeleteFrom)}. Maybe they were already deleted?`
    );
  } else {
    await deleteMessagesLocallyOnly({ conversation, messages, deletionType });
  }
  return deletedFromSwarm;
}
