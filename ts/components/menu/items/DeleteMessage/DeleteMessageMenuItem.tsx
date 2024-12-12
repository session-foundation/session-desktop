import { useCallback } from 'react';
import { deleteMessagesForX } from '../../../../interactions/conversations/unsendingInteractions';
import {
  useMessageIsDeletable,
  useMessageIsDeletableForEveryone,
  useMessageStatus,
} from '../../../../state/selectors';
import {
  useSelectedConversationKey,
  useSelectedIsPublic,
} from '../../../../state/selectors/selectedConversation';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';

export const DeleteItem = ({ messageId }: { messageId: string }) => {
  const convoId = useSelectedConversationKey();
  const isPublic = useSelectedIsPublic();

  const isDeletable = useMessageIsDeletable(messageId);
  const isDeletableForEveryone = useMessageIsDeletableForEveryone(messageId);
  const messageStatus = useMessageStatus(messageId);

  const enforceDeleteServerSide = isPublic && messageStatus !== 'error';

  const onDelete = useCallback(() => {
    if (convoId) {
      void deleteMessagesForX([messageId], convoId, enforceDeleteServerSide);
    }
  }, [convoId, enforceDeleteServerSide, messageId]);

  if (!convoId || (isPublic && !isDeletableForEveryone) || (!isPublic && !isDeletable)) {
    return null;
  }

  return <ItemWithDataTestId onClick={onDelete}>{window.i18n('delete')}</ItemWithDataTestId>;
};
