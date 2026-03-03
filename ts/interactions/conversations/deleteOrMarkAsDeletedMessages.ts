/* eslint-disable no-await-in-loop */
import type { ConversationModel } from '../../models/conversation';
import type { MessageModel } from '../../models/message';
import type { WithActionContext, WithLocalMessageDeletionType } from '../../session/types/with';

/**
 * Deletes a message completely or mark it as deleted.
 * Does not interact with the swarm at all.

 */
export async function deleteOrMarkAsDeletedMessages({
  conversation,
  messages,
  deletionType,
  actionContextIsUI,
}: WithLocalMessageDeletionType &
  WithActionContext & {
    conversation: ConversationModel;
    messages: Array<MessageModel>;
  }) {
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    // - a control message is forcefully removed from the DB, no matter the requested deletion type
    // - an already marked as deleted message is forcefully removed from the DB only when the action is done via the UI
    if (
      deletionType === 'complete' ||
      message.isControlMessage() ||
      (message.isMarkedAsDeleted() && actionContextIsUI)
    ) {
      await conversation.removeMessage(message.id);
    } else {
      // just mark the message as deleted but still show in conversation
      await message.markAsDeleted(deletionType);
    }
  }
}
