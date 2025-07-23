import styled from 'styled-components';
import { AttachmentType, getExtensionForDisplay } from '../../types/Attachment';
import { StagedAttachmentsCloseButton } from './StagedAttachementsCloseButton';
import { LucideIcon } from '../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

type Props = {
  attachment: AttachmentType;
  onClose: (attachment: AttachmentType) => void;
};

const StyledIconExtension = styled.div`
  font-size: var(--font-size-sm);
  letter-spacing: 0.2px;
  text-transform: uppercase;

  // Along with flow layout in parent item, centers text
  text-align: center;
  margin-inline-start: auto;
  margin-inline-end: auto;

  // We don't have much room for text here, cut it off without ellipse
  overflow-x: hidden;
  white-space: nowrap;
  text-overflow: clip;

  color: var(--text-primary-color);
`;

const StyledFilename = styled.div`
  text-align: center;
  font-size: var(--font-size-sm);

  white-space: break-spaces;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  text-overflow: ellipsis;
  margin-inline: var(--margins-xs);
`;

const StyledGenericAttachment = styled.div`
  height: 120px;
  width: 120px;
  margin: 1px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  border-radius: 4px;
  gap: var(--margins-sm);
  box-shadow: inset 0px 0px 0px 1px var(--border-color);
  background-color: var(--message-link-preview-background-color);
  text-align: center;
`;

export function StagedGenericAttachment(props: Props) {
  const { attachment, onClose } = props;
  const { fileName, contentType } = attachment;
  const extension = getExtensionForDisplay({ contentType, fileName });

  return (
    <StyledGenericAttachment>
      <StagedAttachmentsCloseButton
        onClick={() => {
          onClose?.(attachment);
        }}
      />
      <LucideIcon
        iconSize="large"
        unicode={LUCIDE_ICONS_UNICODE.FILE}
        iconColor="var(--text-primary-color)"
      />
      {extension ? <StyledIconExtension>{extension.slice(0, 4)}</StyledIconExtension> : null}

      <StyledFilename>{fileName}</StyledFilename>
    </StyledGenericAttachment>
  );
}
