import { compact, flatten, isEqual } from 'lodash';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import useInterval from 'react-use/lib/useInterval';

import { Data } from '../../../../data/data';

import { useIsRightPanelShowing } from '../../../../hooks/useUI';
import { Constants } from '../../../../session';
import { useSelectedConversationKey } from '../../../../state/selectors/selectedConversation';
import { AttachmentTypeWithPath } from '../../../../types/Attachment';
import { getAbsoluteAttachmentPath } from '../../../../types/MessageAttachment';
import { Flex } from '../../../basic/Flex';
import { SpacerLG, SpacerXL } from '../../../basic/Text';
import { PanelButtonGroup } from '../../../buttons';
import { MediaItemType } from '../../../lightbox/LightboxGallery';
import { MediaGallery } from '../../media-gallery/MediaGallery';
import { Header, HeaderTitle, StyledScrollContainer } from './components';
import { closeRightPanel } from '../../../../state/ducks/conversations';
import { useConversationUsername } from '../../../../hooks/useParamSelector';
import { PubKey } from '../../../../session/types';
import { sectionActions } from '../../../../state/ducks/section';

async function getMediaGalleryProps(conversationId: string): Promise<{
  documents: Array<MediaItemType>;
  media: Array<MediaItemType>;
}> {
  // We fetch more documents than media as they don’t require to be loaded
  // into memory right away. Revisit this once we have infinite scrolling:
  const rawMedia = await Data.getMessagesWithVisualMediaAttachments(
    conversationId,
    Constants.CONVERSATION.DEFAULT_MEDIA_FETCH_COUNT
  );
  const rawDocuments = await Data.getMessagesWithFileAttachments(
    conversationId,
    Constants.CONVERSATION.DEFAULT_DOCUMENTS_FETCH_COUNT
  );

  const media = flatten(
    rawMedia.map(attributes => {
      const { attachments, source, id, timestamp, serverTimestamp, received_at } = attributes;

      return (attachments || [])
        .filter(
          (attachment: AttachmentTypeWithPath) =>
            attachment.thumbnail && !attachment.pending && !attachment.error
        )
        .map((attachment: AttachmentTypeWithPath, index: number) => {
          const { thumbnail } = attachment;

          const mediaItem: MediaItemType = {
            objectURL: getAbsoluteAttachmentPath(attachment.path),
            thumbnailObjectUrl: thumbnail ? getAbsoluteAttachmentPath(thumbnail.path) : undefined,
            contentType: attachment.contentType || '',
            index,
            messageTimestamp: timestamp || serverTimestamp || received_at || 0,
            messageSender: source,
            messageId: id,
            attachment,
          };

          return mediaItem;
        });
    })
  );

  // Unlike visual media, only one non-image attachment is supported
  const documents = rawDocuments.map(attributes => {
    // this is to not fail if the attachment is invalid (could be a Long Attachment type which is not supported)
    if (!attributes.attachments?.length) {
      // window?.log?.info(
      //   'Got a message with an empty list of attachment. Skipping...'
      // );
      return null;
    }
    const attachment = attributes.attachments[0];
    const { source, id, timestamp, serverTimestamp, received_at } = attributes;

    return {
      contentType: attachment.contentType,
      index: 0,
      attachment,
      messageTimestamp: timestamp || serverTimestamp || received_at || 0,
      messageSender: source,
      messageId: id,
    };
  });

  return {
    media,
    documents: compact(documents), // remove null
  };
}

export const OverlayRightPanelSettings = () => {
  const [documents, setDocuments] = useState<Array<MediaItemType>>([]);
  const [media, setMedia] = useState<Array<MediaItemType>>([]);
  const dispatch = useDispatch();

  const selectedConvoKey = useSelectedConversationKey();
  const isShowing = useIsRightPanelShowing();
  const displayName = useConversationUsername(selectedConvoKey);

  const closePanel = () => {
    dispatch(closeRightPanel());
    dispatch(sectionActions.resetRightOverlayMode());
  };

  useEffect(() => {
    let isCancelled = false;

    const loadDocumentsOrMedia = async () => {
      try {
        if (isShowing && selectedConvoKey) {
          const results = await getMediaGalleryProps(selectedConvoKey);

          if (!isCancelled) {
            if (!isEqual(documents, results.documents)) {
              setDocuments(results.documents);
            }

            if (!isEqual(media, results.media)) {
              setMedia(results.media);
            }
          }
        }
      } catch (error) {
        if (!isCancelled) {
          window.log.debug(`OverlayRightPanelSettings loadDocumentsOrMedia: ${error}`);
        }
      }
    };

    void loadDocumentsOrMedia();

    return () => {
      isCancelled = true;
    };
  }, [documents, isShowing, media, selectedConvoKey]);

  useInterval(async () => {
    if (isShowing && selectedConvoKey) {
      const results = await getMediaGalleryProps(selectedConvoKey);
      if (results.documents.length !== documents.length || results.media.length !== media.length) {
        setDocuments(results.documents);
        setMedia(results.media);
      }
    }
  }, 10000);

  if (!selectedConvoKey) {
    return null;
  }

  return (
    <StyledScrollContainer>
      <Flex $container={true} $flexDirection={'column'} $alignItems={'center'}>
        <Header
          hideCloseButton={false}
          closeButtonOnClick={closePanel}
          paddingTop="var(--margins-2xl)"
        >
          <HeaderTitle>{displayName || PubKey.shorten(selectedConvoKey)}</HeaderTitle>
        </Header>
        <PanelButtonGroup style={{ margin: '0 var(--margins-lg)' }}>
          <MediaGallery documents={documents} media={media} />
        </PanelButtonGroup>
        <SpacerLG />
        <SpacerXL />
      </Flex>
    </StyledScrollContainer>
  );
};
