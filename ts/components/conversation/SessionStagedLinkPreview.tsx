import AbortController, { AbortSignal } from 'abort-controller';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import insecureNodeFetch from 'node-fetch';

import { isUndefined } from 'lodash';

import useUpdate from 'react-use/lib/useUpdate';
import useUnmount from 'react-use/lib/useUnmount';
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
import { isDevProd } from '../../shared/env_vars';

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

type SessionStagedLinkPreviewProps = {
  draft: string;
  enabledLinkPreviewsDuringLinkPaste: boolean;
};

export const SessionStagedLinkPreview = (props: SessionStagedLinkPreviewProps) => {
  // Don't generate link previews if user has turned them off, the pasted link means the settings key has changed and we have a link
  if (
    !window.getSettingValue(SettingsKey.settingsLinkPreview) &&
    !props.enabledLinkPreviewsDuringLinkPaste
  ) {
    return null;
  }

  return <SessionStagedLinkPreviewComp {...props} />;
};

type StagedLinkPreview = {
  title: string | null;
  url: string | null;
  domain: string | null;
  // NOTE: ts has an issue trying to resolve the direct type from the original file, which is why this is used
  scaledDown: Awaited<ReturnType<typeof getPreview>>['scaledDown'] | null;
};

class PreviewFetch {
  readonly link: string;
  readonly abortController: AbortController;
  readonly timeoutId: ReturnType<typeof setTimeout>;

  constructor(link: string) {
    this.link = link;
    this.abortController = new AbortController();
    this.timeoutId = setTimeout(() => {
      this.cleanup();
    }, LINK_PREVIEW_TIMEOUT);
  }

  cleanup() {
    if (!this.abortController.signal.aborted) {
      this.abortController.abort();
    }
    clearTimeout(this.timeoutId);
  }

  /**
   * Fetch the link preview data.
   * A return of false means dont cache the result, otherwise cache the result.
   */
  async fetch(): Promise<StagedLinkPreview | null | false> {
    try {
      const ret = await getPreview(this.link, this.abortController.signal);
      if (this.abortController.signal.aborted) {
        return false;
      }
      // we finished loading the preview, and checking the abortController, we are still not aborted.
      // => update the staged preview
      if (ret) {
        return {
          title: ret.title || null,
          url: ret.url || null,
          domain: (ret.url && LinkPreviews.getDomain(ret.url)) || '',
          scaledDown: ret.scaledDown,
        };
      }
    } catch (e) {
      window?.log?.error(e);
      if (this.abortController.signal.aborted) {
        return false;
      }
    }
    return null;
  }
}

const previews = new Map<string, StagedLinkPreview | null>();

const SessionStagedLinkPreviewComp = ({ draft }: SessionStagedLinkPreviewProps) => {
  const [hiddenLink, setHiddenLink] = useState<string | null>(null);
  const forceUpdate = useUpdate();

  const firstLink = useMemo(() => {
    // we try to match the first link found in the current message
    const links = LinkPreviews.findLinks(draft, undefined);
    return links[0];
  }, [draft]);

  const onClose = useCallback(() => {
    setHiddenLink(firstLink);
    forceUpdate();
  }, [forceUpdate, firstLink]);

  const previewFetch = useRef<PreviewFetch | null>(null);

  const handleFetchResult = useCallback(
    async (previewFetchInstance: PreviewFetch) => {
      const result = await previewFetchInstance.fetch();
      if (result !== false) {
        previews.set(previewFetchInstance.link, result);
      }
      // Forces the UI to refresh in case the result changes the data state
      forceUpdate();
    },
    [forceUpdate]
  );

  const handleFetchLinkPreview = useCallback(
    (link: string) => {
      if (previews.has(link)) {
        return;
      }

      if (!LinkPreviews.isLinkSafeToPreview(link)) {
        return;
      }

      if (previewFetch.current) {
        previewFetch.current.cleanup();
      }

      previewFetch.current = new PreviewFetch(link);
      // Forces the UI to enter the loading state in case it doesnt do that by itself
      forceUpdate();
      void handleFetchResult(previewFetch.current);
    },
    [forceUpdate, handleFetchResult]
  );

  useEffect(() => {
    if (firstLink) {
      handleFetchLinkPreview(firstLink);
    }
  }, [firstLink, handleFetchLinkPreview]);

  const data = previews.get(firstLink);

  const isLoading = !!(
    isUndefined(data) &&
    previewFetch.current &&
    previewFetch.current.link === firstLink &&
    !previewFetch.current.abortController.signal.aborted
  );

  useUnmount(() => {
    if (previewFetch.current) {
      previewFetch.current.cleanup();
    }
  });

  if (firstLink === hiddenLink) {
    return null;
  }

  return <StagedLinkPreview isLoading={isLoading} data={data} onClose={onClose} />;
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

type StagedLinkPreviewProps = {
  isLoading: boolean;
  data: StagedLinkPreview | null | undefined;
  onClose: () => void;
};

const StagedLinkPreview = ({ isLoading, data, onClose }: StagedLinkPreviewProps) => {
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

  if (!data && !isLoading) {
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
        onClick={onClose}
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
