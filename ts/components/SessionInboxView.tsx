import { Provider } from 'react-redux';
import { AnimatePresence } from 'framer-motion';
import { LeftPane } from './leftpane/LeftPane';
import { SessionMainPanel } from './SessionMainPanel';
import { SessionTheme } from '../themes/SessionTheme';
import { Flex } from './basic/Flex';
import { useSelectedConversationKey } from '../state/selectors/selectedConversation';
import styled, { css } from 'styled-components';
import { ReactiveFlex } from './basic/ReactiveFlex';

const StyledGutter = styled.div<{ $conversationActive: boolean }>`
  @media screen and (min-width: 799px) {
    position: inherit;
    width: var(--left-panel-width);
  }

  ${({ $conversationActive }) =>
    $conversationActive
      ? css``
      : css`
          z-index: 1;
          width: 100%;
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
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
            <ReactiveFlex $container={true} height="0" $flexShrink={100} $flexGrow={1}>
              <MobileStyledGutter>
                <LeftPane />
              </MobileStyledGutter>
              <SessionMainPanel />
            </ReactiveFlex>
          </AnimatePresence>
        </SessionTheme>
      </Provider>
    </div>
  );
};
