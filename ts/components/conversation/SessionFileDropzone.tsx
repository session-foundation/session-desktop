import styled from 'styled-components';
import { Flex } from '../basic/Flex';
import { LucideIcon } from '../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

const DropZoneContainer = styled.div`
  display: inline-block;
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

const DropZoneWithBorder = styled.div`
  border: dashed 4px var(--file-dropzone-border-color);
  background-color: var(--file-dropzone-background-color);
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  opacity: 0.5;
  pointer-events: none;
`;

export const SessionFileDropzone = () => {
  return (
    <DropZoneContainer>
      <DropZoneWithBorder>
        <Flex $container={true} $justifyContent="space-around" height="100%" $alignItems="center">
          <LucideIcon
            iconColor="var(--file-dropzone-border-color)"
            iconSize={'max'}
            unicode={LUCIDE_ICONS_UNICODE.CIRCLE_PLUS}
          />
        </Flex>
      </DropZoneWithBorder>
    </DropZoneContainer>
  );
};
