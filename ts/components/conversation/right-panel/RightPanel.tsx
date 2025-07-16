import styled from 'styled-components';
import { useRightOverlayMode } from '../../../hooks/useUI';
import { Flex } from '../../basic/Flex';
import { OverlayRightPanelSettings } from './overlay/OverlayRightPanelSettings';
import { OverlayMessageInfo } from './overlay/message-info/OverlayMessageInfo';
import { isRtlBody } from '../../../util/i18n/rtlSupport';

export const StyledRightPanelContainer = styled.div`
  position: absolute;
  height: var(--right-panel-height);
  width: var(--right-panel-width);
  right: 0vw;

  transition: transform var(--duration-right-panel) linear;
  transform: translateX(100%);
  z-index: 3;

  background-color: var(--background-primary-color);
  border-left: 1px solid var(--border-color);

  &.show {
    transform: translateX(0);
  }
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
      return <OverlayRightPanelSettings />;
  }
};

export const RightPanel = () => {
  const isRtlMode = isRtlBody();

  return (
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
  );
};
