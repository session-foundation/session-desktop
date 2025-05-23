import type { SessionDataTestId } from 'react';
import styled from 'styled-components';

const LucideIconWrapper = styled.div<{ iconColor?: string; iconSize: string }>`
  font-family: var(--font-icon);
  font-size: ${({ iconSize }) => iconSize};
  color: ${({ iconColor }) => iconColor};
`;

export type LucideIconProps = {
  unicode: string;
  iconColor?: string;
  iconSize: string;
  dataTestId?: SessionDataTestId;
};

/**
 * This is a wrapper around Lucide icons with unicode.
 */
export const LucideIcon = ({ unicode, iconColor, iconSize, dataTestId }: LucideIconProps) => {
  return (
    <LucideIconWrapper iconColor={iconColor} iconSize={iconSize} data-testid={dataTestId}>
      {unicode}
    </LucideIconWrapper>
  );
};
