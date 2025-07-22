import { useCallback } from 'react';
import clsx from 'clsx';

import { filesize } from 'filesize';
import { useSelectedConversationKey } from '../../../state/selectors/selectedConversation';
import { saveAttachmentToDisk } from '../../../util/attachmentsUtil';
import { MediaItemType } from '../../lightbox/LightboxGallery';
import { formatDateWithLocale } from '../../../util/i18n/formatting/generics';
import { LucideIcon } from '../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';

type Props = {
  // Required
  timestamp: number;

  // Optional
  fileName?: string;
  fileSize?: number | null;
  shouldShowSeparator?: boolean;
  mediaItem: MediaItemType;
};

export const DocumentListItem = (props: Props) => {
  const { shouldShowSeparator, fileName, fileSize, timestamp } = props;

  const defaultShowSeparator = shouldShowSeparator === undefined ? true : shouldShowSeparator;
  const selectedConversationKey = useSelectedConversationKey();

  if (!selectedConversationKey) {
    throw new Error('DocumentListItem: selectedConversationKey was not set');
  }

  const saveAttachmentCallback = useCallback(() => {
    void saveAttachmentToDisk({
      messageSender: props.mediaItem.messageSender,
      messageTimestamp: props.mediaItem.messageTimestamp,
      attachment: props.mediaItem.attachment,
      conversationId: selectedConversationKey,
      index: 0,
    });
  }, [
    selectedConversationKey,
    props.mediaItem.messageSender,
    props.mediaItem.messageTimestamp,
    props.mediaItem.attachment,
  ]);

  return (
    <div
      className={clsx(
        'module-document-list-item',
        defaultShowSeparator ? 'module-document-list-item--with-separator' : null
      )}
    >
      <div
        className="module-document-list-item__content"
        role="button"
        onClick={saveAttachmentCallback}
      >
        <LucideIcon iconSize="huge" unicode={LUCIDE_ICONS_UNICODE.FILE} />
        <div className="module-document-list-item__metadata">
          <span className="module-document-list-item__file-name">{fileName}</span>
          <span className="module-document-list-item__file-size">
            {typeof fileSize === 'number' ? filesize(fileSize) : ''}
          </span>
        </div>
        <div className="module-document-list-item__date">
          {formatDateWithLocale({ date: new Date(timestamp), formatStr: 'd LLL, yyyy' })}
        </div>
      </div>
    </div>
  );
};
