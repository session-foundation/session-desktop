import { type SessionDataTestId } from 'react';
import type { CSSProperties } from 'styled-components';
import styled from 'styled-components';

const StyledKnob = styled.div<{ active: boolean }>`
  position: absolute;
  top: ${props => (props.active ? '1px' : '0.5px')};
  left: ${props => (props.active ? '2px' : '0.5px')};
  height: 21px;
  width: 21px;
  border-radius: 28px;
  background-color: var(--toggle-switch-ball-color);
  box-shadow: ${props =>
    props.active
      ? '-2px 1px 3px var(--toggle-switch-ball-shadow-color);'
      : '2px 1px 3px var(--toggle-switch-ball-shadow-color);'};

  transition:
    transform var(--default-duration) ease,
    background-color var(--default-duration) ease;

  transform: ${props => (props.active ? 'translateX(25px)' : '')};
  pointer-events: none; // let the container handle the event
`;

const StyledSessionToggle = styled.div<{ active: boolean; disabled: boolean }>`
  width: 51px;
  height: 25px;
  border: 1px solid var(--toggle-switch-off-border-color);
  border-radius: 16px;
  position: relative;
  cursor: ${props => (props.disabled ? 'not-allowed' : 'pointer')};
  transition: var(--default-duration);
  flex-shrink: 0;

  background-color: ${props =>
    props.active
      ? 'var(--toggle-switch-on-background-color)'
      : 'var(--toggle-switch-off-background-color)'};
  border-color: ${props =>
    props.active
      ? 'var(--toggle-switch-on-border-color)'
      : 'var(--toggle-switch-off-border-color)'};
`;

export const SessionToggle = ({
  active,
  dataTestId,
  onClick,
  style,
}: {
  active: boolean;
  /**
   * if `onClick` is undefined, the toggle won't be clickable and disabled
   */
  onClick?: () => void;
  dataTestId?: SessionDataTestId;
  style?: CSSProperties;
}) => {
  return (
    <StyledSessionToggle
      role="button"
      active={active}
      data-testid={dataTestId}
      data-active={active}
      onClick={onClick}
      disabled={!onClick}
      style={style}
    >
      <StyledKnob active={active} />
    </StyledSessionToggle>
  );
};
