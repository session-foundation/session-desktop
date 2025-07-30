import { ConversationModel } from '../../models/conversation';
import { MessageModel } from '../../models/message';
import { PubKey } from '../../session/types';
import { UserUtils } from '../../session/utils';
import { ed25519Str } from '../../session/utils/String';

import { deleteMessagesLocallyOnly } from './deleteMessagesLocallyOnly';
import { deleteMessagesFromSwarmOnly } from './deleteMessagesFromSwarmOnly';

/**
 * Delete the messages from the swarm with an unsend request and if it worked, delete those messages locally.
 * If an error happened, we just return false, Toast an error, and do not remove the messages locally at all.
 */
export async function deleteMessagesFromSwarmAndCompletelyLocally(
  conversation: ConversationModel,
  messages: Array<MessageModel>
) {
  // If this is a private chat, we can only delete messages on our own swarm, so use our "side" of the conversation
  const pubkey = conversation.isPrivate() ? UserUtils.getOurPubKeyStrFromCache() : conversation.id;
  if (!PubKey.is03Pubkey(pubkey) && !PubKey.is05Pubkey(pubkey)) {
    throw new Error('deleteMessagesFromSwarmAndCompletelyLocally needs a 03 or 05 pk');
  }
  if (PubKey.is05Pubkey(pubkey) && pubkey !== UserUtils.getOurPubKeyStrFromCache()) {
    window.log.warn(
      'deleteMessagesFromSwarmAndCompletelyLocally with 05 pk can only delete for ourself'
    );
    return;
  }
  // LEGACY GROUPS are deprecated
  if (conversation.isClosedGroup() && PubKey.is05Pubkey(pubkey)) {
    window.log.info('legacy groups are deprecated.');

    return;
  }
  window.log.info(
    'Deleting from swarm of ',
    ed25519Str(pubkey),
    ' hashes: ',
    messages.map(m => m.get('messageHash'))
  );
  const deletedFromSwarm = await deleteMessagesFromSwarmOnly(messages, pubkey);
  if (!deletedFromSwarm) {
    window.log.warn(
      'deleteMessagesFromSwarmAndCompletelyLocally: some messages failed to be deleted. Maybe they were already deleted?'
    );
  }
  await deleteMessagesLocallyOnly({ conversation, messages, deletionType: 'complete' });
}

/**
 * Delete the messages from the swarm with an unsend request and mark those messages locally as deleted but do not remove them.
 * If an error happened, we still mark the message locally as deleted.
 */
export async function deleteMessagesFromSwarmAndMarkAsDeletedLocally(
  conversation: ConversationModel,
  messages: Array<MessageModel>
) {
  // legacy groups are deprecated
  if (conversation.isClosedGroup() && PubKey.is05Pubkey(conversation.id)) {
    window.log.info('legacy groups are deprecated. Not deleting anything');

    return;
  }

  // we can only delete messages on the swarm when they are on our own swarm, or it is a groupv2 that we are the admin off
  const pubkeyToDeleteFrom = PubKey.is03Pubkey(conversation.id)
    ? conversation.id
    : UserUtils.getOurPubKeyStrFromCache();

  // if this is a groupv2 and we don't have the admin key, it will fail and return false.
  const deletedFromSwarm = await deleteMessagesFromSwarmOnly(messages, pubkeyToDeleteFrom);
  if (!deletedFromSwarm) {
    window.log.warn(
      'deleteMessagesFromSwarmAndMarkAsDeletedLocally: some messages failed to be deleted but still removing the messages content... '
    );
  }
  await deleteMessagesLocallyOnly({ conversation, messages, deletionType: 'markDeleted' });
}
