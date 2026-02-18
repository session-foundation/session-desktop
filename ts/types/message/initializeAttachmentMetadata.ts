import { isEmpty } from 'lodash';
import { MessageModel } from '../../models/message';
import * as Attachment from '../Attachment';

const hasAttachmentInMessage =
  (predicate: (value: Attachment.Attachment) => boolean) =>
  (message: MessageModel): boolean =>
    Boolean((message.get('attachments') || []).some(predicate));

export const hasFileAttachmentInMessage = hasAttachmentInMessage(Attachment.isFile);
export const hasVisualMediaAttachmentInMessage = hasAttachmentInMessage(Attachment.isVisualMedia);

export const getAttachmentMetadata = (
  message: MessageModel
): {
  hasAttachments: 1 | 0;
  hasFileAttachments: 1 | 0;
  hasVisualMediaAttachments: 1 | 0;
} => {
  // Note: this hasAttachments needs  to be 1 if there is at least one attachment.
  // It is used to know which attachments we have locally we need to remove.
  // Missing a kind of attachment here (like preview) would delete that message on the next start.
  const hasAttachments =
    (message.get('attachments') || []).length || !isEmpty(message.get('preview')?.[0]?.image)
      ? 1
      : 0;
  const hasFileAttachments = hasFileAttachmentInMessage(message) ? 1 : 0;
  const hasVisualMediaAttachments = hasVisualMediaAttachmentInMessage(message) ? 1 : 0;

  return {
    hasAttachments,
    hasFileAttachments,
    hasVisualMediaAttachments,
  };
};
