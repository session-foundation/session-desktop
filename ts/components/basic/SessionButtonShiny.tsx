import styled, { keyframes } from 'styled-components';
import { SessionButton, type SessionButtonProps, StyledBaseButton } from './SessionButton';

const shine = keyframes`
  0% {
    transform: translateX(-100%);
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
    transform: translateX(-100%);
    animation: ${shine} 0.6s ease-in-out infinite;
    animation-delay: 0s;
    animation-iteration-count: infinite;
    animation-duration: 3.6s; /* 0.6s shine + 3s pause */
  }
`;

export function SessionButtonShiny(props: SessionButtonProps) {
  return (
    <ShinyButtonContainer style={props.style}>
      <SessionButton {...props} />
    </ShinyButtonContainer>
  );
}
