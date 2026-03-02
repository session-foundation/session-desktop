import { ConversationModel } from '../../models/conversation';
import { MessageModel } from '../../models/message';
import { PubKey } from '../../session/types';
import { UserUtils } from '../../session/utils';
import { ed25519Str } from '../../session/utils/String';

import { deleteOrMarkAsDeletedMessages } from './deleteOrMarkAsDeletedMessages';
import { deleteMessagesFromSwarmOnly } from './deleteMessagesFromSwarmOnly';
import { ConvoHub } from '../../session/conversations';
import type { WithActionContext, WithLocalMessageDeletionType } from '../../session/types/with';

export async function deleteMessagesFromSwarmAndDeleteOrMarkAsDeleted({
  conversation,
  deletionType,
  messages,
  actionContextIsUI,
}: WithLocalMessageDeletionType &
  WithActionContext & {
    conversation: ConversationModel;
    messages: Array<MessageModel>;
  }) {
  // legacy groups are deprecated
  if (conversation.isClosedGroup() && PubKey.is05Pubkey(conversation.id)) {
    throw new Error('legacy groups are deprecated. Not deleting anything');
  }
  if (conversation.isPrivateAndBlinded()) {
    throw new Error(
      `deleteMessagesFromSwarmAndDeleteOrMarkAsDeleted ${deletionType} does not support blinded conversations`
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
    throw new Error(
      `deleteMessagesFromSwarmAndDeleteOrMarkAsDeleted ${deletionType} needs a 03 or 05 pk`
    );
  }
  if (
    PubKey.is05Pubkey(pubkeyToDeleteFrom) &&
    pubkeyToDeleteFrom !== UserUtils.getOurPubKeyStrFromCache()
  ) {
    throw new Error(
      `deleteMessagesFromSwarmAndDeleteOrMarkAsDeleted ${deletionType} with 05 pk can only delete for ourself`
    );
  }

  window.log.info(
    `deleteMessagesFromSwarmAndDeleteOrMarkAsDeleted ${deletionType}: Deleting from swarm of  ${ed25519Str(pubkeyToDeleteFrom)}, hashes: ${messages.map(m => m.getMessageHash())}`
  );

  const convo = ConvoHub.use().get(conversation.id);
  if (!convo) {
    throw new Error(
      `deleteMessagesFromSwarmAndDeleteOrMarkAsDeleted ${deletionType} convo not found`
    );
  }

  const deletedFromSwarm = await deleteMessagesFromSwarmOnly(convo, messages);
  if (!deletedFromSwarm) {
    window.log.warn(
      `deleteMessagesFromSwarmAndDeleteOrMarkAsDeleted ${deletionType}: some messages failed to be deleted from swarm of ${ed25519Str(pubkeyToDeleteFrom)}. Maybe they were already deleted?`
    );
  } else {
    await deleteOrMarkAsDeletedMessages({
      conversation,
      messages,
      deletionType,
      actionContextIsUI,
    });
  }
  return deletedFromSwarm;
}
