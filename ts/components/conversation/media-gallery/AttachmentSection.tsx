import styled from 'styled-components';
import type { JSX } from 'react';
import { missingCaseError } from '../../../util/missingCaseError';
import { MediaItemType } from '../../lightbox/LightboxGallery';
import { DocumentListItem } from './DocumentListItem';
import { MediaGridItem } from './MediaGridItem';

type Props = {
  type: 'media' | 'documents';
  mediaItems: Array<MediaItemType>;
};

const Items = (props: Props): JSX.Element => {
  const { mediaItems, type } = props;

  return (
    <>
      {mediaItems.map((mediaItem, position, array) => {
        const shouldShowSeparator = position < array.length - 1;
        const { index, attachment, messageTimestamp, messageId } = mediaItem;

        switch (type) {
          case 'media':
            return (
              <MediaGridItem
                key={`${messageId}-${index}`}
                mediaItem={mediaItem}
                mediaItems={mediaItems}
              />
            );
          case 'documents':
            return (
              <DocumentListItem
                key={`${messageId}-${index}`}
                fileName={attachment.fileName}
                fileSize={attachment.size}
                shouldShowSeparator={shouldShowSeparator}
                timestamp={messageTimestamp}
                mediaItem={mediaItem}
              />
            );
          default:
            throw missingCaseError(type);
        }
      })}
    </>
  );
};

const StyledAttachmentSection = styled.div`
  width: 100%;
`;

const StyledAttachmentSectionItems = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: flex-start;
`;

const StyledAttachmentSectionItemsMedia = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
  grid-gap: var(--margins-sm);
`;

const StyledAttachmentSectionItemsDocuments = styled.div`
  width: 100%;
`;

export const AttachmentSection = (props: Props) => {
  const { type } = props;

  return (
    <StyledAttachmentSection>
      <StyledAttachmentSectionItems>
        {type === 'media' ? (
          <StyledAttachmentSectionItemsMedia>
            <Items {...props} />
          </StyledAttachmentSectionItemsMedia>
        ) : (
          <StyledAttachmentSectionItemsDocuments>
            <Items {...props} />
          </StyledAttachmentSectionItemsDocuments>
        )}
      </StyledAttachmentSectionItems>
    </StyledAttachmentSection>
  );
};
