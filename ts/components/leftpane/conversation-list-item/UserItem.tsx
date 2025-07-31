import { useConvoIdFromContext } from '../../../contexts/ConvoIdContext';
import { useIsSearchingForType } from '../../../state/selectors/search';
import { ContactName } from '../../conversation/ContactName/ContactName';

export const UserItem = () => {
  const conversationId = useConvoIdFromContext();
  const isSearchResultsMode = useIsSearchingForType('global');
  
  return (
    <ContactName
      pubkey={conversationId}
      module="module-conversation__user"
      contactNameContext={
        isSearchResultsMode ? 'conversation-list-item-search' : 'conversation-list-item'
      }
      conversationId={conversationId}
    />
  );
};
