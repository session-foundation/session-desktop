import styled from 'styled-components';

import {
  areAllAttachmentsVisual,
  AttachmentType,
  AttachmentTypeWithPath,
  getAlt,
  getThumbnailUrl,
  isVideoAttachment,
} from '../../types/Attachment';

import { useIsMessageVisible } from '../../contexts/isMessageVisibleContext';
import { THUMBNAIL_SIDE } from '../../types/attachments/VisualAttachment';
import { Image } from './Image';

type Props = {
  attachments: Array<AttachmentTypeWithPath>;
  onError: () => void;
  imageBroken: boolean;
  highlight: boolean;
  onClickAttachment?: (attachment: AttachmentTypeWithPath | AttachmentType) => void;
};

const StyledImageGrid = styled.div<{ $flexDirection: 'row' | 'column' }>`
  display: inline-flex;
  align-items: center;
  gap: var(--margins-sm);
  flex-direction: ${props => props.$flexDirection};
`;

const Row = (
  props: Props & {
    renderedSize: number;
    startIndex: number;
    totalAttachmentsCount: number;
  }
) => {
  const {
    attachments,
    imageBroken,
    highlight,
    onError,
    renderedSize,
    startIndex,
    onClickAttachment,
    totalAttachmentsCount,
  } = props;
  const isMessageVisible = useIsMessageVisible();
  const moreMessagesOverlay = totalAttachmentsCount > 3;
  const moreMessagesOverlayText = moreMessagesOverlay ? `+${totalAttachmentsCount - 3}` : undefined;

  return (
    <>
      {attachments.map((attachment, index) => {
        const showOverlay = index === 1 && moreMessagesOverlay;
        return (
          <Image
            alt={getAlt(attachment)}
            attachment={attachment}
            playIconOverlay={isVideoAttachment(attachment)}
            height={renderedSize}
            key={attachment.id}
            width={renderedSize}
            url={isMessageVisible ? getThumbnailUrl(attachment) : undefined}
            attachmentIndex={startIndex + index}
            onClick={onClickAttachment}
            imageBroken={imageBroken}
            highlight={highlight}
            onError={onError}
            softCorners={true}
            darkOverlay={showOverlay}
            overlayText={showOverlay ? moreMessagesOverlayText : undefined}
          />
        );
      })}
    </>
  );
};

export const ImageGrid = (props: Props) => {
  const { attachments, imageBroken, highlight, onError, onClickAttachment } = props;

  if (!attachments || !attachments.length) {
    return null;
  }

  if (attachments.length === 1 || !areAllAttachmentsVisual(attachments)) {
    return (
      <StyledImageGrid $flexDirection={'row'}>
        <Row
          attachments={attachments.slice(0, 1)}
          imageBroken={imageBroken}
          highlight={highlight}
          onError={onError}
          onClickAttachment={onClickAttachment}
          renderedSize={THUMBNAIL_SIDE}
          startIndex={0}
          totalAttachmentsCount={attachments.length}
        />
      </StyledImageGrid>
    );
  }

  if (attachments.length === 2) {
    // when we got 2 attachments we render them side by side with the full size of THUMBNAIL_SIDE
    return (
      <StyledImageGrid $flexDirection={'row'}>
        <Row
          attachments={attachments.slice(0, 2)}
          imageBroken={imageBroken}
          highlight={highlight}
          onError={onError}
          onClickAttachment={onClickAttachment}
          renderedSize={THUMBNAIL_SIDE}
          startIndex={0}
          totalAttachmentsCount={attachments.length}
        />
      </StyledImageGrid>
    );
  }

  const columnImageSide = THUMBNAIL_SIDE / 2 - 5;

  // we know only support having 3 attachments displayed at most, the rest are on the overlay
  return (
    <StyledImageGrid $flexDirection={'row'}>
      <Row
        attachments={attachments.slice(0, 1)}
        imageBroken={imageBroken}
        highlight={highlight}
        onError={onError}
        onClickAttachment={onClickAttachment}
        renderedSize={THUMBNAIL_SIDE}
        startIndex={0}
        totalAttachmentsCount={attachments.length}
      />

      <StyledImageGrid $flexDirection={'column'}>
        <Row
          attachments={attachments.slice(1, 3)}
          imageBroken={imageBroken}
          highlight={highlight}
          onError={onError}
          onClickAttachment={onClickAttachment}
          renderedSize={columnImageSide}
          startIndex={1}
          totalAttachmentsCount={attachments.length}
        />
      </StyledImageGrid>
    </StyledImageGrid>
  );
};
