import { SessionIconSize } from '../../icon';
import { AnimatedSpinnerIconWrapper } from './AnimatedSpinnerIcon';

type AnimatedSpinnerIconProps = {
  size: SessionIconSize;
};

export function AnimatedArrowSpinnerIcon({ size }: AnimatedSpinnerIconProps) {
  return (
    <AnimatedSpinnerIconWrapper size={size}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-primary-color)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label="Loading"
        transform="scale(-0.85, 0.85)"
      >
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="360 12 12"
            to="0 12 12"
            dur="1.5s"
            repeatCount="indefinite"
          />
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        </g>
      </svg>
    </AnimatedSpinnerIconWrapper>
  );
}
