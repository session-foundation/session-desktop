import type { ConversationModel } from '../../models/conversation';
import type { MessageModel } from '../../models/message';
import type { WithLocalMessageDeletionType } from '../../session/types/with';

/**
 * Deletes a message completely or mark it as deleted. Does not interact with the swarm at all
 * @param message Message to delete
 * @param deletionType 'complete' means completely delete the item from the database, markDeleted means empty the message content but keep an entry
 */
export async function deleteMessagesLocallyOnly({
  conversation,
  messages,
  deletionType,
}: WithLocalMessageDeletionType & {
  conversation: ConversationModel;
  messages: Array<MessageModel>;
}) {
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (deletionType === 'complete') {
      // remove the message from the database
      // eslint-disable-next-line no-await-in-loop
      await conversation.removeMessage(message.id);
    } else {
      // just mark the message as deleted but still show in conversation
      // eslint-disable-next-line no-await-in-loop
      await message.markAsDeleted();
    }
  }

  conversation.updateLastMessage();
}
