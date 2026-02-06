import { ItemParams } from 'react-contexify';
import { isNumber } from 'lodash';
import { MessageInteraction } from '../interactions';
import { replyToMessage } from '../interactions/conversationInteractions';
import { pushUnblockToSend } from '../session/utils/Toast';
import { getAppDispatch } from '../state/dispatch';
import { toggleSelectedMessageId } from '../state/ducks/conversations';
import {
  useSelectedConversationKey,
  useSelectedIsBlocked,
} from '../state/selectors/selectedConversation';
import { Reactions } from '../util/reactions';
import {
  useMessageAttachments,
  useMessageBody,
  useMessageSender,
  useMessageServerTimestamp,
  useMessageStatus,
  useMessageTimestamp,
} from '../state/selectors';
import { saveAttachmentToDisk } from '../util/attachment/attachmentsUtil';
import { deleteMessagesForX } from '../interactions/conversations/unsendingInteractions';

function useSaveAttachemnt(messageId?: string) {
  const convoId = useSelectedConversationKey();
  const attachments = useMessageAttachments(messageId);
  const timestamp = useMessageTimestamp(messageId);
  const serverTimestamp = useMessageServerTimestamp(messageId);
  const sender = useMessageSender(messageId);

  return (e: ItemParams) => {
    // this is quite dirty but considering that we want the context menu of the message to show on click on the attachment
    // and the context menu save attachment item to save the right attachment I did not find a better way for now.
    // Note: If you change this, also make sure to update the `handleContextMenu()` in GenericReadableMessage.tsx
    const targetAttachmentIndex = isNumber(e?.props?.dataAttachmentIndex)
      ? e.props.dataAttachmentIndex
      : 0;
    e.event.stopPropagation();
    if (!attachments?.length || !convoId || !sender) {
      return;
    }

    if (targetAttachmentIndex > attachments.length) {
      return;
    }
    const messageTimestamp = timestamp || serverTimestamp || 0;
    void saveAttachmentToDisk({
      attachment: attachments[targetAttachmentIndex],
      messageTimestamp,
      messageSender: sender,
      conversationId: convoId,
      index: targetAttachmentIndex,
    });
  };
}

function useCopyText(messageId?: string) {
  const text = useMessageBody(messageId);

  return () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    // Note: we want to allow to copy through the "Copy" menu item the currently selected text, if any.
    MessageInteraction.copyBodyToClipboard(selectedText || text);
  };
}

function useReply(messageId?: string) {
  const isSelectedBlocked = useSelectedIsBlocked();
  return () => {
    if (!messageId) {
      return;
    }
    if (isSelectedBlocked) {
      pushUnblockToSend();
      return;
    }
    void replyToMessage(messageId);
  };
}

function useDelete(messageId?: string) {
  const messageStatus = useMessageStatus(messageId);
  return (isPublic: boolean, convoId?: string) => {
    if (convoId && messageId) {
      const enforceDeleteServerSide = isPublic && messageStatus !== 'error';
      void deleteMessagesForX([messageId], convoId, enforceDeleteServerSide);
    }
  };
}

export function useMessageInteractions(messageId?: string | null) {
  const dispatch = getAppDispatch();

  const copyText = useCopyText(messageId ?? undefined);
  const saveAttachment = useSaveAttachemnt(messageId ?? undefined);

  const reply = useReply(messageId ?? undefined);
  const deleteFromConvo = useDelete(messageId ?? undefined);

  const select = () => {
    if (!messageId) {
      return;
    }

    dispatch(toggleSelectedMessageId(messageId));
  };

  const reactToMessage = async (emoji: string) => {
    if (!messageId) {
      return;
    }

    await Reactions.sendMessageReaction(messageId, emoji);
  };

  return {
    copyText,
    saveAttachment,
    reply,
    select,
    reactToMessage,
    deleteFromConvo,
  };
}
