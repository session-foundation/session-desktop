import styled from 'styled-components';
import { SessionIconSize } from '../../icon';
import { IconSizeToPxStr } from '../../icon/SessionIcon';

export const AnimatedSpinnerIconWrapper = styled.div<{ size: SessionIconSize }>`
  height: ${props => IconSizeToPxStr[props.size]};
  width: ${props => IconSizeToPxStr[props.size]};
`;

type AnimatedSpinnerIconProps = {
  size: SessionIconSize;
};

export function AnimatedSpinnerIcon({ size }: AnimatedSpinnerIconProps) {
  return (
    <AnimatedSpinnerIconWrapper size={size}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        stroke="var(--text-primary-color)"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        viewBox="0 0 24 24"
      >
        <path d="M12 2v4">
          <animate
            attributeName="stroke-opacity"
            begin="0s"
            dur="1.6s"
            repeatCount="indefinite"
            values="1;0.2;1"
          />
        </path>
        <path d="m16.2 7.8 2.9-2.9">
          <animate
            attributeName="stroke-opacity"
            begin="0.2s"
            dur="1.6s"
            repeatCount="indefinite"
            values="1;0.2;1"
          />
        </path>
        <path d="M18 12h4">
          <animate
            attributeName="stroke-opacity"
            begin="0.4s"
            dur="1.6s"
            repeatCount="indefinite"
            values="1;0.2;1"
          />
        </path>
        <path d="m16.2 16.2 2.9 2.9">
          <animate
            attributeName="stroke-opacity"
            begin="0.6s"
            dur="1.6s"
            repeatCount="indefinite"
            values="1;0.2;1"
          />
        </path>
        <path d="M12 18v4">
          <animate
            attributeName="stroke-opacity"
            begin="0.8s"
            dur="1.6s"
            repeatCount="indefinite"
            values="1;0.2;1"
          />
        </path>
        <path d="m4.9 19.1 2.9-2.9">
          <animate
            attributeName="stroke-opacity"
            begin="1.0s"
            dur="1.6s"
            repeatCount="indefinite"
            values="1;0.2;1"
          />
        </path>
        <path d="M2 12h4">
          <animate
            attributeName="stroke-opacity"
            begin="1.2s"
            dur="1.6s"
            repeatCount="indefinite"
            values="1;0.2;1"
          />
        </path>
        <path d="m4.9 4.9 2.9 2.9">
          <animate
            attributeName="stroke-opacity"
            begin="1.4s"
            dur="1.6s"
            repeatCount="indefinite"
            values="1;0.2;1"
          />
        </path>
      </svg>
    </AnimatedSpinnerIconWrapper>
  );
}
