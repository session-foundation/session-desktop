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
import { createButtonOnKeyDownForClickEventHandler } from '../../../util/keyboardShortcuts';
import { getAppDispatch } from '../../../state/dispatch';
import { focusVisibleBoxShadowOutset } from '../../../styles/focusVisible';
import { Menu, MenuItem } from '../../menu/items/MenuItem';
import { SessionContextMenuContainer } from '../../SessionContextMenuContainer';
import { tr } from '../../../localization';
import { saveAttachmentToDisk } from '../../../util/attachment/attachmentsUtil';
import { useSelectedConversationKey } from '../../../state/selectors/selectedConversation';
import { showContextMenu } from '../../../util/contextMenu';

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

  ${focusVisibleBoxShadowOutset()}
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

const MediaGridItemContent = ({ mediaItem }: Pick<Props, 'mediaItem'>) => {
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

export const MediaGridItem = ({ mediaItem, mediaItems }: Props) => {
  const dispatch = getAppDispatch();
  const msgId = mediaItem.messageId;
  const contextMenuId = `media-grid-item-menu-${msgId}`;

  const onClick = () => {
    const lightBoxOptions: LightBoxOptions = {
      media: mediaItems,
      attachment: mediaItem.attachment,
    };

    dispatch(updateLightBoxOptions(lightBoxOptions));
  };
  const onKeyDown = createButtonOnKeyDownForClickEventHandler(onClick);

  return (
    <StyledMediaGridItem
      role="button"
      onClick={onClick}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onContextMenu={e => {
        showContextMenu({ event: e, id: contextMenuId });
      }}
    >
      <MediaGridItemContent mediaItem={mediaItem} />
      <GridItemContextMenu contextMenuId={contextMenuId} mediaItem={mediaItem} />
    </StyledMediaGridItem>
  );
};

function GridItemContextMenu({
  contextMenuId,
  mediaItem,
}: {
  contextMenuId: string;
  mediaItem: MediaItemType;
}) {
  const selectedConversationKey = useSelectedConversationKey();
  function onSave() {
    if (selectedConversationKey) {
      void saveAttachmentToDisk({
        attachment: mediaItem.attachment,
        index: mediaItem.index,
        messageSender: mediaItem.messageSender,
        messageTimestamp: mediaItem.messageTimestamp,
        conversationId: selectedConversationKey,
      });
    }
  }

  return (
    <SessionContextMenuContainer>
      <Menu id={contextMenuId}>
        <MenuItem
          iconType={LUCIDE_ICONS_UNICODE.ARROW_DOWN_TO_LINE}
          isDangerAction={false}
          onClick={onSave}
        >
          {tr('save')}
        </MenuItem>
      </Menu>
    </SessionContextMenuContainer>
  );
}
