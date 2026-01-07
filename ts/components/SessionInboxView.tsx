import { Provider } from 'react-redux';
import styled from 'styled-components';
import { AnimatePresence } from 'framer-motion';
import { LeftPane } from './leftpane/LeftPane';
import { SessionMainPanel } from './SessionMainPanel';
import { SessionTheme } from '../themes/SessionTheme';
import { Flex } from './basic/Flex';

const StyledGutter = styled.div`
  width: var(--left-panel-width) !important;
  transition: none;
`;

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
