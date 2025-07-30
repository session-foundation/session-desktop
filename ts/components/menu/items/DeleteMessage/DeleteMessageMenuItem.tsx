import { useSelectedConversationKey } from '../../../../state/selectors/selectedConversation';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { tr } from '../../../../localization/localeTools';
import { useDeleteMessagesCb } from '../../../menuAndSettingsHooks/useDeleteMessagesCb';

export const DeleteItem = ({ messageId }: { messageId: string }) => {
  const convoId = useSelectedConversationKey();

  const deleteMessagesCb = useDeleteMessagesCb(convoId);

  if (!deleteMessagesCb) {
    return null;
  }

  return (
    <ItemWithDataTestId
      onClick={() => {
        void deleteMessagesCb?.(messageId);
      }}
    >
      {tr('delete')}
    </ItemWithDataTestId>
  );
};
