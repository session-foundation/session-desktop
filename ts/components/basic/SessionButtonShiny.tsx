import styled, { keyframes, type CSSProperties } from 'styled-components';
import { SessionButton, type SessionButtonProps, StyledBaseButton } from './SessionButton';

/**
 * Note: we want 0.6s shine + 3s pause
 */
const shine = keyframes`
 0% {
    transform: translateX(-100%);
  }
  16.6% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(100%);
  }
`;

const ShinyButtonContainer = styled.div`
  ${StyledBaseButton}::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    animation: ${shine} 0.6s ease-in-out infinite;
    animation-delay: 0s;
    animation-iteration-count: infinite;
    animation-duration: 3.6s; /* 0.6s shine + 3s pause */
  }
`;

export function SessionButtonShiny({
  shinyContainerStyle,
  ...props
}: SessionButtonProps & { shinyContainerStyle: CSSProperties }) {
  return (
    <ShinyButtonContainer style={shinyContainerStyle}>
      <SessionButton {...props} />
    </ShinyButtonContainer>
  );
}
