import type { CSSProperties, SessionDataTestId } from 'react';
import styled from 'styled-components';

const FileIconWrapper = styled.img<{ $iconSize: string }>`
  height: ${({ $iconSize: iconSize }) => iconSize};
  width: ${({ $iconSize: iconSize }) => iconSize};
`;

export type FileIconProps = {
  iconSize: string;
  src: string;
  dataTestId?: SessionDataTestId;
  style?: CSSProperties;
};

export const FileIcon = ({ iconSize, dataTestId, src, style }: FileIconProps) => {
  return <FileIconWrapper $iconSize={iconSize} data-testid={dataTestId} style={style} src={src} />;
};
