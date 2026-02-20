import { type MouseEvent } from 'react';
import { ItemParams } from 'react-contexify';
import { isNumber } from 'lodash';
import { MessageInteraction } from '../interactions';
import { replyToMessage } from '../interactions/conversationInteractions';
import { pushUnblockToSend } from '../session/utils/Toast';
import { getAppDispatch } from '../state/dispatch';
import { toggleSelectedMessageId } from '../state/ducks/conversations';
import {
  useIsMessageSelectionMode,
  useSelectedConversationKey,
  useSelectedIsBlocked,
} from '../state/selectors/selectedConversation';
import {
  useMessageAttachments,
  useMessageBody,
  useMessageDirection,
  useMessageSender,
  useMessageServerTimestamp,
  useMessageStatus,
  useMessageTimestamp,
} from '../state/selectors';
import { saveAttachmentToDisk } from '../util/attachment/attachmentsUtil';
import { Reactions } from '../util/reactions';

export function useSaveAttachment(messageId?: string) {
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

export function useCopyText(messageId?: string) {
  const text = useMessageBody(messageId);

  const cannotCopy = !messageId;

  return cannotCopy
    ? null
    : () => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();
        // Note: we want to allow to copy through the "Copy" menu item the currently selected text, if any.
        MessageInteraction.copyBodyToClipboard(selectedText || text);
      };
}

export function useReply(messageId?: string) {
  const isSelectedBlocked = useSelectedIsBlocked();
  const direction = useMessageDirection(messageId);
  const status = useMessageStatus(messageId);

  const isOutgoing = direction === 'outgoing';
  const isSendingOrError = status === 'sending' || status === 'error';

  // NOTE: we dont want to allow to reply to outgoing messages that failed to send or is sending
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

export function useReactToMessage(messageId?: string) {
  const cannotReact = !messageId;

  return cannotReact
    ? null
    : async (emoji: string) => {
        await Reactions.sendMessageReaction(messageId, emoji);
      };
}

/**
 * Cb to invoke when a manual click to "select" in the msg context menu is done.
 * i.e. starts the Multi selection mode
 * @see `useSelectMessageViaClick`
 */
export function useSelectMessageViaMenuCb(messageId?: string | null) {
  const dispatch = getAppDispatch();
  const multiSelectMode = useIsMessageSelectionMode();

  if (!messageId || multiSelectMode) {
    return null;
  }

  return () => {
    dispatch(toggleSelectedMessageId(messageId));
  };
}

/**
 * Cb to invite when we are in multi select mode and a message is clicked
 */
export function useSelectMessageViaClick(messageId?: string | null) {
  const dispatch = getAppDispatch();
  const multiSelectMode = useIsMessageSelectionMode();

  // we can only select via click on msg once multi select mode is already on
  if (!messageId || !multiSelectMode) {
    return null;
  }

  return (event: MouseEvent<unknown>) => {
    event.preventDefault();
    event.stopPropagation();
    dispatch(toggleSelectedMessageId(messageId));
  };
}
