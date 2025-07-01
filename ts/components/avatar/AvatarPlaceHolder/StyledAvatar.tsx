import styled from 'styled-components';

export const StyledAvatar = styled.div<{ $diameter: number }>`
  width: ${({ $diameter }) => $diameter}px;
  height: ${({ $diameter }) => $diameter}px;
`;
