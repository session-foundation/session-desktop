import { useCallback, useState } from 'react';
import clsx from 'clsx';

import { MediaItemType } from '../../lightbox/LightboxGallery';
import { AttachmentSection } from './AttachmentSection';
import { EmptyState } from './EmptyState';

type Props = {
  documents: Array<MediaItemType>;
  media: Array<MediaItemType>;
};

type TabType = 'media' | 'documents';

const Tab = ({
  isSelected,
  label,
  onSelect,
}: {
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}) => {
  return (
    <div
      className={clsx(
        'module-media-gallery__tab',
        isSelected ? 'module-media-gallery__tab--active' : null
      )}
      onClick={onSelect}
      role="tab"
    >
      {label}
    </div>
  );
};

const Sections = (props: Props & { selectedTab: TabType }) => {
  const { media, documents, selectedTab } = props;

  const mediaItems = selectedTab === 'media' ? media : documents;
  const type = selectedTab;

  if (!mediaItems || mediaItems.length === 0) {
    const label =
      type === 'media'
        ? window.i18n('attachmentsMediaEmpty')
        : window.i18n('attachmentsFilesEmpty');

    return <EmptyState data-testid="EmptyState" label={label} />;
  }

  return (
    <div className="module-media-gallery__sections">
      <AttachmentSection key="mediaItems" type={type} mediaItems={mediaItems} />
    </div>
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
    <div className="module-media-gallery">
      <div className="module-media-gallery__tab-container">
        <Tab label={window.i18n('media')} isSelected={isMediaSelected} onSelect={setMediaTab} />
        <Tab
          label={window.i18n('files')}
          isSelected={isDocumentSelected}
          onSelect={setDocumentsTab}
        />
      </div>
      <div className="module-media-gallery__content">
        <Sections {...props} selectedTab={selectedTab} />
      </div>
    </div>
  );
};
