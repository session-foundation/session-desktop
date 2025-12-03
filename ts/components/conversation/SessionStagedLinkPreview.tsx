import { AbortSignal } from 'abort-controller';
import { useEffect, useMemo } from 'react';
import styled from 'styled-components';

import type { RequestInit, Response } from 'node-fetch';
import { StagedLinkPreviewData } from './composition/CompositionBox';

import { Image } from './Image';

import { isImage } from '../../types/MIME';
import { Flex } from '../basic/Flex';
import { SessionSpinner } from '../loading';
import { AriaLabels } from '../../util/hardcodedAriaLabels';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { tr } from '../../localization/localeTools';

import { LinkPreviewUtil } from '../../util';
import { fetchLinkPreviewImage } from '../../util/linkPreviewFetch';
import { LinkPreviews } from '../../util/linkPreviews';
import { maxThumbnailDetails } from '../../util/attachment/attachmentSizes';
import { ImageProcessor } from '../../webworker/workers/browser/image_processor_interface';
import { FetchDestination, insecureNodeFetch } from '../../session/utils/InsecureNodeFetch';

function insecureDirectNodeFetch(href: string, init: RequestInit): Promise<Response> {
  return insecureNodeFetch({
    url: href,
    fetchOptions: init,
    destination: FetchDestination.PUBLIC,
    caller: 'insecureDirectNodeFetch (linkPreviews)',
  });
}

interface StagedLinkPreviewProps extends StagedLinkPreviewData {
  onClose: (url: string) => void;
}
export const LINK_PREVIEW_TIMEOUT = 20 * 1000;

export const getPreview = async (url: string, abortSignal: AbortSignal) => {
  // This is already checked elsewhere, but we want to be extra-careful.
  if (!LinkPreviews.isLinkSafeToPreview(url)) {
    throw new Error('Link not safe for preview');
  }

  window?.log?.info('insecureNodeFetch => plaintext for getPreview()');

  const linkPreviewMetadata = await LinkPreviewUtil.fetchLinkPreviewMetadata(
    insecureDirectNodeFetch,
    url,
    abortSignal
  );
  if (!linkPreviewMetadata) {
    throw new Error('Could not fetch link preview metadata');
  }
  const { title, imageHref } = linkPreviewMetadata;

  if (imageHref && LinkPreviews.isLinkSafeToPreview(imageHref)) {
    try {
      window?.log?.info('insecureNodeFetch => plaintext for getPreview()');

      const fullSizeImage = await fetchLinkPreviewImage(
        insecureDirectNodeFetch,
        imageHref,
        abortSignal
      );
      if (!fullSizeImage) {
        throw new Error('Failed to fetch link preview image');
      }

      // Ensure that this file is either small enough or is resized to meet our
      //   requirements for link preview thumbnails
      const processed = await ImageProcessor.processForLinkPreviewThumbnail(
        fullSizeImage.data,
        maxThumbnailDetails.maxSide
      );

      return {
        title,
        url,
        scaledDown: processed,
      };
    } catch (error) {
      // We still want to show the preview if we failed to get an image
      window?.log?.error('getPreview failed to get image for link preview:', error.message);
    }
  }

  return {
    title,
    url,
    scaledDown: null,
  };
};

export const SessionStagedLinkPreview = (props: StagedLinkPreviewProps) => {
  if (!props.url) {
    return null;
  }

  return (
    <StagedLinkPreview
      onClose={props.onClose}
      isLoaded={props.isLoaded}
      title={props.title}
      domain={props.domain}
      url={props.url}
      scaledDown={props.scaledDown}
    />
  );
};

// Note Similar to QuotedMessageComposition
const StyledStagedLinkPreview = styled(Flex)`
  position: relative;
  /* Same height as a loaded Image Attachment */
  min-height: 132px;
  border-top: 1px solid var(--border-color);
`;

const StyledImage = styled.div`
  div {
    border-radius: 4px;
    overflow: hidden;
  }
`;

const StyledText = styled(Flex)`
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  display: -webkit-box;
  font-weight: bold;
  margin: 0 0 0 var(--margins-sm);
`;

const StagedLinkPreview = ({
  isLoaded,
  onClose,
  title,
  domain,
  url,
  scaledDown,
}: StagedLinkPreviewProps) => {
  const isContentTypeImage = scaledDown && isImage(scaledDown.contentType);

  const blobUrl = useMemo(() => {
    if (!scaledDown) {
      return undefined;
    }
    const blob = new Blob([scaledDown.outputBuffer], { type: scaledDown.contentType });
    return URL.createObjectURL(blob);
  }, [scaledDown]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (isLoaded && !(title && domain)) {
    return null;
  }

  const isLoading = !isLoaded;

  return (
    <StyledStagedLinkPreview
      $container={true}
      $justifyContent={isLoading ? 'center' : 'space-between'}
      $alignItems="center"
      width={'100%'}
      padding={'var(--margins-md)'}
    >
      <Flex
        $container={true}
        $justifyContent={isLoading ? 'center' : 'flex-start'}
        $alignItems={'center'}
      >
        {isLoading ? (
          <SessionSpinner loading={isLoading} data-testid="link-preview-loading" />
        ) : null}
        {isLoaded && isContentTypeImage ? (
          <StyledImage data-testid="link-preview-image">
            <Image
              alt={AriaLabels.imageStagedLinkPreview}
              attachment={{} as any} // we just provide the blobUrl in this case
              height={100}
              width={100}
              url={blobUrl}
              softCorners={true}
            />
          </StyledImage>
        ) : null}
        {isLoaded ? <StyledText data-testid="link-preview-title">{title}</StyledText> : null}
      </Flex>
      <SessionLucideIconButton
        unicode={LUCIDE_ICONS_UNICODE.X}
        iconColor="var(--chat-buttons-icon-color)"
        iconSize="medium"
        onClick={() => {
          onClose(url || '');
        }}
        margin={'0 var(--margin-close-button-composition-box) 0 0'} // we want this aligned with the send button
        aria-label={tr('close')}
        dataTestId="link-preview-close"
        style={{
          position: isLoading ? 'absolute' : undefined,
          right: isLoading ? 'var(--margins-sm)' : undefined,
        }}
      />
    </StyledStagedLinkPreview>
  );
};
