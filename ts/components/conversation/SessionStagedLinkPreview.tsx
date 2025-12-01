import AbortController, { AbortSignal } from 'abort-controller';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import insecureNodeFetch from 'node-fetch';

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
import { DURATION } from '../../session/constants';
import { SettingsKey } from '../../data/settings-key';
import { useSelectedConversationKey } from '../../state/selectors/selectedConversation';
import { ProcessedLinkPreviewThumbnailType } from '../../webworker/workers/node/image_processor/image_processor';
import { isDevProd } from '../../shared/env_vars';

interface StagedLinkPreviewProps extends StagedLinkPreviewData {
  onClose: (url: string) => void;
}
export const LINK_PREVIEW_TIMEOUT = 20 * DURATION.SECONDS;

export const getPreview = async (url: string, abortSignal: AbortSignal) => {
  // This is already checked elsewhere, but we want to be extra-careful.
  if (!LinkPreviews.isLinkSafeToPreview(url)) {
    throw new Error(`Link not safe for preview ${isDevProd() ? url : ''}`);
  }

  window?.log?.info('insecureNodeFetch => plaintext for getPreview()');

  const linkPreviewMetadata = await LinkPreviewUtil.fetchLinkPreviewMetadata(
    insecureNodeFetch,
    url,
    abortSignal
  );
  if (!linkPreviewMetadata) {
    throw new Error(`Could not fetch link preview metadata ${isDevProd() ? url : ''}`);
  }
  const { title, imageHref } = linkPreviewMetadata;

  if (imageHref && LinkPreviews.isLinkSafeToPreview(imageHref)) {
    try {
      window?.log?.info('insecureNodeFetch => plaintext for getPreview()');

      const fullSizeImage = await fetchLinkPreviewImage(insecureNodeFetch, imageHref, abortSignal);
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

type Props = {
  draft: string;
};
export const SessionStagedLinkPreview = (props: Props) => {
  // Don't generate link previews if user has turned them off
  if (!window.getSettingValue(SettingsKey.settingsLinkPreview)) {
    return null;
  }

  return <SessionStagedLinkPreviewComp {...props} />;
};

type StagedLinkPreview = {
  title: string | null;
  url: string | null;
  domain: string | null;
  scaledDown: ProcessedLinkPreviewThumbnailType | null;
};

const SessionStagedLinkPreviewComp = ({ draft }: Props) => {
  const [fetchingLink, setFetchingLink] = useState<string | null>(null);

  const firstLink = useMemo(() => {
    // we try to match the first link found in the current message
    const links = LinkPreviews.findLinks(draft, undefined);
    return links[0];
  }, [draft]);

  const previews = useRef(new Map<string, StagedLinkPreview>());
  const fetchTimeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const fetchLinkPreview = useCallback(async (link: string, signal: AbortSignal) => {
    try {
      const ret = await getPreview(link, signal);
      // we finished loading the preview, and checking the abortController, we are still not aborted.
      // => update the staged preview
      if (!signal.aborted) {
        const newData = {
          title: ret?.title || null,
          url: ret?.url || null,
          domain: (ret?.url && LinkPreviews.getDomain(ret.url)) || '',
          scaledDown: ret?.scaledDown,
        };
        previews.current.set(link, newData);
      }
    } catch (e) {
      window?.log?.warn('fetch link preview: ', e);
    }
  }, []);

  const handleFetchLinkPreview = useCallback(
    (link: string) => {
      if (link === fetchingLink) {
        return;
      }
      setFetchingLink(link);

      abortController.current?.abort();
      abortController.current = new AbortController();

      if (fetchTimeoutId.current) {
        clearTimeout(fetchTimeoutId.current);
      }

      fetchTimeoutId.current = setTimeout(() => {
        if (abortController.current && !abortController.current.signal.aborted) {
          abortController.current.abort();
        }
      }, LINK_PREVIEW_TIMEOUT);

      void fetchLinkPreview(link, abortController.current.signal);
    },
    [fetchLinkPreview]
  );

  useEffect(() => {
    if (!previews.current.has(firstLink)) {
      if (!LinkPreviews.isLinkSafeToPreview(firstLink)) {
        return;
      }
      handleFetchLinkPreview(firstLink);
    }
  }, [firstLink, handleFetchLinkPreview]);

  const data = previews.current.get(firstLink) || null;
  const isLoading = abortController.current?.signal && !abortController.current?.signal?.aborted;

  return <StagedLinkPreview isLoading={!!(!data && isLoading)} data={data} />;
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
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: StagedLinkPreview | null;
}) => {
  const blobUrl = useMemo(() => {
    if (!data?.scaledDown) {
      return null;
    }
    const blob = new Blob([data.scaledDown.outputBuffer], { type: data.scaledDown.contentType });
    return URL.createObjectURL(blob);
  }, [data?.scaledDown]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (!data) {
    return null;
  }

  const isContentTypeImage = data?.scaledDown && isImage(data.scaledDown.contentType);
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
        {!isLoading && isContentTypeImage && blobUrl ? (
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
        {!isLoading && data?.title ? (
          <StyledText data-testid="link-preview-title">{data.title}</StyledText>
        ) : null}
      </Flex>
      <SessionLucideIconButton
        unicode={LUCIDE_ICONS_UNICODE.X}
        iconColor="var(--chat-buttons-icon-color)"
        iconSize="medium"
        // onClick={() => {
        //  onClose(url || '');
        // }}
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
