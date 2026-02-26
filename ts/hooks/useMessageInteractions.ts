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
  useMessageDirection,
  useMessageIsDeletable,
  useMessageSender,
  useMessageServerTimestamp,
  useMessageStatus,
  useMessageTimestamp,
} from '../state/selectors';
import { saveAttachmentToDisk } from '../util/attachment/attachmentsUtil';
import { deleteMessagesForX } from '../interactions/conversations/unsendingInteractions';

export function useMessageSaveAttachment(messageId?: string) {
  const convoId = useSelectedConversationKey();
  const attachments = useMessageAttachments(messageId);
  const timestamp = useMessageTimestamp(messageId);
  const serverTimestamp = useMessageServerTimestamp(messageId);
  const sender = useMessageSender(messageId);

  const cannotSave =
    !messageId ||
    !convoId ||
    !sender ||
    !attachments?.length ||
    !attachments.every(m => !m.pending && m.path);

  return cannotSave
    ? null
    : (e: ItemParams) => {
        // this is quite dirty but considering that we want the context menu of the message to show on click on the attachment
        // and the context menu save attachment item to save the right attachment I did not find a better way for now.
        // Note: If you change this, also make sure to update the `handleContextMenu()` in GenericReadableMessage.tsx
        const targetAttachmentIndex = isNumber(e?.props?.dataAttachmentIndex)
          ? e.props.dataAttachmentIndex
          : 0;
        e.event.stopPropagation();
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

export function useMessageCopyText(messageId?: string) {
  const text = useMessageBody(messageId);

  const cannotCopy = !messageId;

  return cannotCopy
    ? null
    : () => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();
        // NOTE: the copy action should copy selected text (if any) then fallback to the whole message
        MessageInteraction.copyBodyToClipboard(selectedText || text);
      };
}

export function useMessageReply(messageId?: string) {
  const isSelectedBlocked = useSelectedIsBlocked();
  const direction = useMessageDirection(messageId);
  const status = useMessageStatus(messageId);

  const isOutgoing = direction === 'outgoing';
  const isSendingOrError = status === 'sending' || status === 'error';

  // NOTE: we don't want to allow replying to outgoing messages that failed to send or messages currently sending
  const cannotReply = !messageId || (isOutgoing && isSendingOrError);

  return cannotReply
    ? null
    : () => {
        if (isSelectedBlocked) {
          pushUnblockToSend();
          return;
        }
        void replyToMessage(messageId);
      };
}

export function useMessageDelete(messageId?: string) {
  const messageStatus = useMessageStatus(messageId);
  const cannotDelete = !messageId;

  return cannotDelete
    ? null
    : (isPublic: boolean, convoId?: string) => {
        if (convoId) {
          const enforceDeleteServerSide = isPublic && messageStatus !== 'error';
          void deleteMessagesForX([messageId], convoId, enforceDeleteServerSide);
        }
      };
}

export function useMessageSelect(messageId?: string) {
  const dispatch = getAppDispatch();
  const isDeletable = useMessageIsDeletable(messageId);
  const cannotSelect = !messageId || !isDeletable;

  return cannotSelect
    ? null
    : () => {
        dispatch(toggleSelectedMessageId(messageId));
      };
}

export function useMessageReact(messageId?: string) {
  const cannotReact = !messageId;

  return cannotReact
    ? null
    : async (emoji: string) => {
        await Reactions.sendMessageReaction(messageId, emoji);
      };
}
