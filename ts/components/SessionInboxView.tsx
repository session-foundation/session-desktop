import { Provider } from 'react-redux';
import { AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { LeftPane } from './leftpane/LeftPane';
import { SessionMainPanel } from './SessionMainPanel';
import { SessionTheme } from '../themes/SessionTheme';
import { Flex } from './basic/Flex';
import { useSelectedConversationKey } from '../state/selectors/selectedConversation';

const StyledGutter = (props: any) => {
  const conversationKey = useSelectedConversationKey();

  return (
    <div
      {...props}
      className={clsx(
        'module-session-inbox-view__styled_gutter',
        conversationKey && 'mobile-active-conversation'
      )}
    />
  );
};

export const SessionInboxView = () => {
  if (!window.inboxStore) {
    throw new Error('window.inboxStore is undefined in SessionInboxView');
  }

  return (
    <div className="inbox index">
      <Provider store={window.inboxStore}>
        <SessionTheme>
          <AnimatePresence>
            <Flex $container={true} height="0" $flexShrink={100} $flexGrow={1}>
              <StyledGutter>
                <LeftPane />
              </StyledGutter>
              <SessionMainPanel />
            </Flex>
          </AnimatePresence>
        </SessionTheme>
      </Provider>
    </div>
  );
};
