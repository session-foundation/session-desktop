import { Provider } from 'react-redux';
import { AnimatePresence } from 'framer-motion';
import { LeftPane } from './leftpane/LeftPane';
import { SessionMainPanel } from './SessionMainPanel';
import { SessionTheme } from '../themes/SessionTheme';
import { Flex } from './basic/Flex';
import { useSelectedConversationKey } from '../state/selectors/selectedConversation';
import styled, { css } from 'styled-components';

const StyledGutter = styled.div<{ $conversationActive: boolean }>`
  width: 100%;

  @media screen and (min-width: 799px) {
    width: var(--left-panel-width);
  }

  ${({ $conversationActive }) =>
    $conversationActive &&
    css`
      width: 1px;
      margin-left: -1px;
      @media screen and (min-width: 799px) {
        width: 100%;
        margin-left: 0px;
        max-width: var(--left-panel-width);
      }
    `}
`;

const MobileStyledGutter = (props: any) => (
  <StyledGutter {...props} $conversationActive={Boolean(useSelectedConversationKey())} />
);

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
              <MobileStyledGutter>
                <LeftPane />
              </MobileStyledGutter>
              <SessionMainPanel />
            </Flex>
          </AnimatePresence>
        </SessionTheme>
      </Provider>
    </div>
  );
};
