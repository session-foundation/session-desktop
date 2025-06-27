import styled from 'styled-components';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import type { WithIconSize } from '../icon/Icons';
import { SessionLucideIconButton } from '../icon/SessionIconButton';

const PlayButtonCentered = styled.div`
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const PlayButtonCenteredAbsolute = ({ iconSize }: WithIconSize) => {
  return (
    <PlayButtonCentered>
      <SessionLucideIconButton
        unicode={LUCIDE_ICONS_UNICODE.PLAY}
        iconSize={iconSize}
        iconColor="var(--chat-buttons-icon-color)"
        backgroundColor="var(--chat-buttons-background-color)"
      />
    </PlayButtonCentered>
  );
};
