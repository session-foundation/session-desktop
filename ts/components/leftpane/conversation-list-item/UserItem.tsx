import type { CSSProperties } from 'styled-components';
import { useConvoIdFromContext } from '../../../contexts/ConvoIdContext';
import { useHasUnread } from '../../../hooks/useParamSelector';
import { useIsSearchingForType } from '../../../state/selectors/search';
import { ContactName } from '../../conversation/ContactName/ContactName';
import { useSelectedConversationKey } from '../../../state/selectors/selectedConversation';

export const UserItem = () => {
  const conversationId = useConvoIdFromContext();
  const isSearchResultsMode = useIsSearchingForType('global');
  const hasUnread = useHasUnread(conversationId);
  const isSelectedConvo = useSelectedConversationKey() === conversationId;

  const style: CSSProperties = {};

  if (isSelectedConvo) {
    style.color = 'var(--conversation-tab-text-selected-color)';
  }
  if (hasUnread) {
    style.color = 'var(--conversation-tab-text-unread-color)';
  }
  return (
    <ContactName
      pubkey={conversationId}
      module="module-conversation__user"
      contactNameContext={
        isSearchResultsMode ? 'conversation-list-item-search' : 'conversation-list-item'
      }
      conversationId={conversationId}
      style={style}
    />
  );
};
