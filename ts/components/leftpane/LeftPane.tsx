import styled from 'styled-components';
import { SessionToastContainer } from '../SessionToastContainer';
import { CallInFullScreenContainer } from '../calling/CallInFullScreenContainer';
import { DraggableCallContainer } from '../calling/DraggableCallContainer';
import { IncomingCallDialog } from '../calling/IncomingCallDialog';
import { ModalContainer } from '../dialog/ModalContainer';
import { ActionsPanel } from './ActionsPanel';
import { LeftPaneMessageSection } from './LeftPaneMessageSection';
import { useIsRtl } from '../../util/i18n/rtlSupport';

export const leftPaneListWidth = 300; // var(--left-panel-width) without the 80px of the action gutter

const StyledLeftPane = styled.div<{ $isRtl: boolean }>`
  width: 100%;
  @media screen and (min-width: 680px) {
    width: ${() => `${leftPaneListWidth}px`};
    height: 100%;
    border-left: 1px solid var(--border-color);
    border-right: 1px solid var(--border-color);
  }
  height: calc(100% - 76px);
  display: inline-flex;
  flex-direction: column;
  position: relative;
  flex-shrink: 0;
  direction: ${({ $isRtl }) => ($isRtl ? 'rtl' : 'ltr')};
`;

const LeftPaneSection = () => {
  return <LeftPaneMessageSection />;
};

const CallContainer = () => {
  return (
    <>
      <DraggableCallContainer />
      <IncomingCallDialog />
      <CallInFullScreenContainer />
    </>
  );
};

const StyledLeftPaneSession = styled.div`
  display: flex;
  flex-direction: column-reverse;
  height: 100%;
  width: 100%;

  @media screen and (min-width: 680px) {
    flex-direction: row;
  }
`;

export const LeftPane = () => {
  const isRtl = useIsRtl();

  return (
    <StyledLeftPaneSession>
      <ModalContainer />
      <CallContainer />
      <SessionToastContainer />
      <ActionsPanel />

      <StyledLeftPane $isRtl={isRtl}>
        <LeftPaneSection />
      </StyledLeftPane>
    </StyledLeftPaneSession>
  );
};
