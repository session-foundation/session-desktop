import styled from 'styled-components';

export type StyledSessionSpinnerProps = {
  loading: boolean;
  height?: string;
  width?: string;
  color?: string;
};

export const StyledSessionSpinner = styled.div<StyledSessionSpinnerProps>`
  display: inline-block;
  position: relative;
  width: ${props => (props.width ? props.width : '80px')};
  height: ${props => (props.height ? props.height : '80px')};
  flex-shrink: 0;

  div {
    position: absolute;
    top: calc(50% - 6.5px);
    width: 16.25%;
    height: 16.25%;
    border-radius: 50%;
    background: ${props => props.color || 'var(--primary-color)'};
    animation-timing-function: cubic-bezier(0, 1, 1, 0);
  }
  div:nth-child(1) {
    left: 10%;
    animation: session-loader1 var(--duration-session-spinner) infinite;
  }
  div:nth-child(2) {
    left: 10%;
    animation: session-loader2 var(--duration-session-spinner) infinite;
  }
  div:nth-child(3) {
    left: 40%;
    animation: session-loader2 var(--duration-session-spinner) infinite;
  }
  div:nth-child(4) {
    left: 70%;
    animation: session-loader3 var(--duration-session-spinner) infinite;
  }
  @keyframes session-loader1 {
    0% {
      transform: scale(0);
    }
    100% {
      transform: scale(1);
    }
  }
  @keyframes session-loader3 {
    0% {
      transform: scale(1);
    }
    100% {
      transform: scale(0);
    }
  }
  @keyframes session-loader2 {
    0% {
      transform: translate(0, 0);
    }
    100% {
      transform: translate(170%, 0);
    }
  }
`;
