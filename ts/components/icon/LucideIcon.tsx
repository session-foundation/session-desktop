import type { CSSProperties, SessionDataTestId } from 'react';
import styled from 'styled-components';
import type { SessionIconSize } from './Icons';
import { IconSizeToPxStr } from './SessionIcon';
import type { WithLucideUnicode } from './lucide';
import { useIsRtl } from '../../util/i18n/rtlSupport';

const LucideIconWrapper = styled.div<{
  $iconColor?: string;
  $iconSize: SessionIconSize;
  $isRtl: boolean;
}>`
  font-family: var(--font-icon);
  font-size: ${props => IconSizeToPxStr[props.$iconSize]};
  color: ${props => props.$iconColor};
  align-content: center;
  ${props => props.$isRtl && 'display: inline-block;  transform: scaleX(-1);'}
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
  const isRtl = useIsRtl();

  return (
    <LucideIconWrapper
      $iconColor={iconColor}
      $iconSize={iconSize}
      data-testid={dataTestId}
      style={{ ...style, lineHeight: 1 }}
      aria-label={ariaLabel}
      $isRtl={isRtl}
    >
      {unicode}
    </LucideIconWrapper>
  );
};
