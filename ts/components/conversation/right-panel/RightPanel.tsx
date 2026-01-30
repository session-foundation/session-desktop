import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useRightOverlayMode } from '../../../hooks/useUI';
import { Flex } from '../../basic/Flex';
import { RightPanelMedia } from './overlay/RightPanelMedia';
import { OverlayMessageInfo } from './overlay/message-info/OverlayMessageInfo';
import { isRtlBody } from '../../../util/i18n/rtlSupport';
import { THEME_GLOBALS } from '../../../themes/globals';
import { sectionActions } from '../../../state/ducks/section';
import { getAppDispatch } from '../../../state/dispatch';
import { removeMessageInfoId } from '../../../state/ducks/conversations';

export const StyledRightPanelContainer = styled(motion.div)`
  position: absolute;
  height: var(--right-panel-height);
  width: var(--right-panel-width);
  right: 0vw;
  z-index: 3;

  background-color: var(--background-primary-color);
  border-left: 1px solid var(--border-color);
`;

const StyledRightPanel = styled(Flex)`
  // no double border (top and bottom) between two elements
  &-item + &-item {
    border-top: none;
  }
`;

const ClosableOverlay = () => {
  const rightOverlayMode = useRightOverlayMode();

  switch (rightOverlayMode?.type) {
    case 'message_info':
      return <OverlayMessageInfo />;
    default:
      return <RightPanelMedia />;
  }
};

export const RightPanel = ({ open }: { open: boolean }) => {
  const dispatch = getAppDispatch();
  const isRtlMode = isRtlBody();

  const onExitComplete = () => {
    dispatch(sectionActions.resetRightOverlayMode());
    dispatch(removeMessageInfoId());
  };

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <StyledRightPanelContainer
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{
            type: 'tween',
            ease: 'linear',
            duration: THEME_GLOBALS['--duration-right-panel-seconds'],
          }}
        >
          <StyledRightPanel
            $container={true}
            $flexDirection={'column'}
            $alignItems={'center'}
            width={'var(--right-panel-width)'}
            height={'var(--right-panel-height)'}
            className="right-panel"
            style={{ direction: isRtlMode ? 'rtl' : 'initial' }}
          >
            <ClosableOverlay />
          </StyledRightPanel>
        </StyledRightPanelContainer>
      )}
    </AnimatePresence>
  );
};
