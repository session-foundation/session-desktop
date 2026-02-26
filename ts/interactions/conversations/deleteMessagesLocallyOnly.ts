/* eslint-disable no-await-in-loop */
import type { ConversationModel } from '../../models/conversation';
import type { MessageModel } from '../../models/message';
import type { WithLocalMessageDeletionType } from '../../session/types/with';

/**
 * Deletes a message completely or mark it as deleted. Does not interact with the swarm at all.
 * Note: no matter the `deletionType`, a control message or a "mark as deleted" message are always removed entirely from the database.
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
    // a control message or a message deleted is forcefully removed from the DB
    if (deletionType === 'complete' || message.isControlMessage() || message.get('isDeleted')) {
      await conversation.removeMessage(message.id);
    } else {
      // just mark the message as deleted but still show in conversation
      await message.markAsDeleted(deletionType === 'markDeletedThisDevice');
    }
  }
}
