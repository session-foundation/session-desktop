import { useCallback, useState } from 'react';
import styled from 'styled-components';

import { MediaItemType } from '../../lightbox/LightboxGallery';
import { AttachmentSection } from './AttachmentSection';
import { EmptyState } from './EmptyState';
import { tr } from '../../../localization/localeTools';
import { createButtonOnKeyDownForClickEventHandler } from '../../../util/keyboardShortcuts';

type Props = {
  documents: Array<MediaItemType>;
  media: Array<MediaItemType>;
};

type TabType = 'media' | 'documents';

const MediaGallerySection = styled.div`
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  width: 100%;
`;

const StyledMediaGallery = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  width: 100%;
  overflow: hidden;
`;

const StyledMediaGalleryTabContainer = styled.div`
  display: flex;
  flex-grow: 0;
  flex-shrink: 0;
  cursor: pointer;
  width: 100%;
  padding-top: 1rem;
`;

const StyledMediaGalleryTab = styled.div<{ $active: boolean }>`
  width: 100%;

  text-align: center;
  color: var(--text-primary-color);
  font-weight: bold;
  font-size: var(--font-display-size-xl);
  border-bottom: none;

  &:after {
    // no content by default, content is set only on active
    display: block;
    margin: 0 auto;
    width: 70%;
    padding-top: 0.5rem;
    border-bottom: 4px solid var(--primary-color);
  }

  ${props =>
    props.$active &&
    `&:after {
      content: ''; /* This is necessary for the pseudo element to work. */
     }`}
`;

const StyledMediaGalleryContent = styled.div`
  display: flex;
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
`;

const Tab = ({
  isSelected,
  label,
  onSelect,
}: {
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}) => {
  const onKeyDown = createButtonOnKeyDownForClickEventHandler(onSelect);
  return (
    <StyledMediaGalleryTab
      $active={isSelected}
      onClick={onSelect}
      role="tab"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {label}
    </StyledMediaGalleryTab>
  );
};

const Sections = (props: Props & { selectedTab: TabType }) => {
  const { media, documents, selectedTab } = props;

  const mediaItems = selectedTab === 'media' ? media : documents;
  const type = selectedTab;

  if (!mediaItems || mediaItems.length === 0) {
    const label = type === 'media' ? tr('attachmentsMediaEmpty') : tr('attachmentsFilesEmpty');

    return <EmptyState data-testid="EmptyState" label={label} />;
  }

  return (
    <MediaGallerySection>
      <AttachmentSection key="mediaItems" type={type} mediaItems={mediaItems} />
    </MediaGallerySection>
  );
};

export const MediaGallery = (props: Props) => {
  const [selectedTab, setSelectedTab] = useState<TabType>('media');

  const isDocumentSelected = selectedTab === 'documents';
  const isMediaSelected = selectedTab === 'media';

  const setMediaTab = useCallback(() => {
    setSelectedTab('media');
  }, []);

  const setDocumentsTab = useCallback(() => {
    setSelectedTab('documents');
  }, []);

  return (
    <StyledMediaGallery>
      <StyledMediaGalleryTabContainer>
        <Tab label={tr('media')} isSelected={isMediaSelected} onSelect={setMediaTab} />
        <Tab label={tr('files')} isSelected={isDocumentSelected} onSelect={setDocumentsTab} />
      </StyledMediaGalleryTabContainer>
      <StyledMediaGalleryContent>
        <Sections {...props} selectedTab={selectedTab} />
      </StyledMediaGalleryContent>
    </StyledMediaGallery>
  );
};
