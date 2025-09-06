import type { CSSProperties, SessionDataTestId } from 'react';
import styled from 'styled-components';
import type { SessionIconSize } from './Icons';
import { IconSizeToPxStr } from './SessionIcon';
import { isIconToMirrorRtl, type WithLucideUnicode } from './lucide';
import { useIsRtl } from '../../util/i18n/rtlSupport';

const LucideIconWrapper = styled.div<{
  $iconColor?: string;
  $iconSize: SessionIconSize;
  $mirrorIt: boolean;
}>`
  font-family: var(--font-icon);
  font-size: ${props => IconSizeToPxStr[props.$iconSize]};
  color: ${props => props.$iconColor};
  align-content: center;
  ${props => props.$mirrorIt && 'display: inline-block;  transform: scaleX(-1);'}
`;

export type LucideIconProps = WithLucideUnicode & {
  iconColor?: string;
  iconSize: SessionIconSize;
  dataTestId?: SessionDataTestId;
  style?: CSSProperties;
  ariaLabel?: string;
  /**
   * set to true to make this icon mirrored when the app is in RTL mode.
   * Note: some icons are enforced not mirrored (e.g. the "check" icon)
   */
  respectRtl?: boolean;
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
  respectRtl = true,
}: LucideIconProps) => {
  const isRtl = useIsRtl();

  return (
    <LucideIconWrapper
      $iconColor={iconColor}
      $iconSize={iconSize}
      data-testid={dataTestId}
      style={{ ...style, lineHeight: 1 }}
      aria-label={ariaLabel}
      $mirrorIt={isRtl && respectRtl && isIconToMirrorRtl(unicode)}
    >
      {unicode}
    </LucideIconWrapper>
  );
};
