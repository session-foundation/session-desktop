import { useAppIsFocused } from '../hooks/useAppFocused';
import { useSelectedConversationKey } from '../state/selectors/selectedConversation';

import { SmartSessionConversation } from '../state/smart/SessionConversation';
import { useHTMLDirection } from '../util/i18n/rtlSupport';

export const SessionMainPanel = () => {
  const htmlDirection = useHTMLDirection();

  // even if it looks like this does nothing, this does update the redux store.
  useAppIsFocused();

  const isConversing = Boolean(useSelectedConversationKey());
  
  return (
    <div className="session-conversation">
      <SmartSessionConversation htmlDirection={htmlDirection} />
    </div>
  );
};
