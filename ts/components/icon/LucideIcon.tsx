import type { CSSProperties, SessionDataTestId } from 'react';
import styled from 'styled-components';
import type { SessionIconSize } from './Icons';
import { IconSizeToPxStr } from './SessionIcon';
import type { WithLucideUnicode } from './lucide';

const LucideIconWrapper = styled.div<{ $iconColor?: string; $iconSize: SessionIconSize }>`
  font-family: var(--font-icon);
  font-size: ${props => IconSizeToPxStr[props.$iconSize]};
  color: ${props => props.$iconColor};
  align-content: center;
`;

export type LucideIconProps = WithLucideUnicode & {
  iconColor?: string;
  iconSize: SessionIconSize;
  dataTestId?: SessionDataTestId;
  style?: CSSProperties;
  ariaLabel?: string;
};

/**
 * This is a wrapper around Lucide icons with unicode.
 */
export const LucideIcon = ({
  unicode,
  iconColor,
  iconSize,
  dataTestId,
  style,
  ariaLabel,
}: LucideIconProps) => {
  return (
    <LucideIconWrapper
      $iconColor={iconColor}
      $iconSize={iconSize}
      data-testid={dataTestId}
      style={{ ...style, lineHeight: 1 }}
      aria-label={ariaLabel}
    >
      {unicode}
    </LucideIconWrapper>
  );
};
