import styled from 'styled-components';
import { useState } from 'react';

import { useDisableDrag } from '../../../hooks/useDisableDrag';
import { useEncryptedFileFetch } from '../../../hooks/useEncryptedFileFetch';
import { LightBoxOptions, updateLightBoxOptions } from '../../../state/ducks/modalDialog';
import { isImageTypeSupported, isVideoTypeSupported } from '../../../util/GoogleChrome';
import { MediaItemType } from '../../lightbox/LightboxGallery';
import { AriaLabels } from '../../../util/hardcodedAriaLabels';
import { PlayButtonCenteredAbsolute } from '../../buttons/PlayButton';
import { LucideIcon } from '../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';

type Props = {
  mediaItem: MediaItemType;
  mediaItems: Array<MediaItemType>;
};

const StyledMediaGridItem = styled.div`
  cursor: pointer;
  background-color: var(--message-link-preview-background-color);
  position: relative;
  width: 100%;
  height: 100%;
`;

const StyledMediaGridItemImage = styled.img`
  object-fit: cover;
  width: 100%;
  height: 100%;
`;

const StyledMediaGridItemImageContainer = styled.div`
  object-fit: cover;
  position: relative;
`;

const MediaGridItemContent = (props: Props) => {
  const { mediaItem } = props;
  const { attachment, contentType } = mediaItem;

  const urlToDecrypt = mediaItem.thumbnailObjectUrl || '';
  const [imageBroken, setImageBroken] = useState(false);

  const { loading, urlToLoad } = useEncryptedFileFetch(urlToDecrypt, contentType, false);

  // data will be url if loading is finished and '' if not
  const srcData = !loading ? urlToLoad : '';
  const disableDrag = useDisableDrag();

  const onImageError = () => {
    window.log.info('MediaGridItem: Image failed to load; failing over to placeholder');
    setImageBroken(true);
  };

  if (!attachment) {
    return null;
  }

  if (contentType && isImageTypeSupported(contentType)) {
    if (imageBroken || !srcData) {
      return (
        <LucideIcon
          iconColor="var(--text-secondary-color)"
          iconSize="small"
          unicode={LUCIDE_ICONS_UNICODE.IMAGE}
        />
      );
    }

    return (
      <StyledMediaGridItemImage
        src={srcData}
        alt={AriaLabels.imageSentInConversation}
        onError={onImageError}
        onDragStart={disableDrag}
      />
    );
  }
  if (contentType && isVideoTypeSupported(contentType)) {
    if (imageBroken || !srcData) {
      return (
        <LucideIcon
          iconColor="var(--text-secondary-color)"
          iconSize="small"
          unicode={LUCIDE_ICONS_UNICODE.CLAPERBOARD}
        />
      );
    }

    return (
      <StyledMediaGridItemImageContainer>
        <StyledMediaGridItemImage
          src={srcData}
          alt={AriaLabels.imageSentInConversation}
          onError={onImageError}
          onDragStart={disableDrag}
        />
        <PlayButtonCenteredAbsolute iconSize="medium" />
      </StyledMediaGridItemImageContainer>
    );
  }

  return <LucideIcon iconSize="small" unicode={LUCIDE_ICONS_UNICODE.FILE} />;
};

export const MediaGridItem = (props: Props) => {
  return (
    <StyledMediaGridItem
      role="button"
      onClick={() => {
        const lightBoxOptions: LightBoxOptions = {
          media: props.mediaItems,
          attachment: props.mediaItem.attachment,
        };

        window.inboxStore?.dispatch(updateLightBoxOptions(lightBoxOptions));
      }}
    >
      <MediaGridItemContent {...props} />
    </StyledMediaGridItem>
  );
};
