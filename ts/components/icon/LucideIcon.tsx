import styled from 'styled-components';

const LucideIconWrapper = styled.span<{ iconColor?: string; iconSize: string }>`
  font-family: var(--font-icon);
  font-size: ${({ iconSize }) => iconSize};
  color: ${({ iconColor }) => iconColor};
`;

/**
 * This is a wrapper around Lucide icons with unicode.
 */
export const LucideIcon = ({
  unicode,
  iconColor,
  iconSize,
}: {
  unicode: string;
  iconColor?: string;
  iconSize: string;
}) => {
  return (
    <LucideIconWrapper iconColor={iconColor} iconSize={iconSize}>
      {unicode}
    </LucideIconWrapper>
  );
};
