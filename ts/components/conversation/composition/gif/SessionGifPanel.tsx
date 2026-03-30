/* eslint-disable more/no-then */
import { useEffect, useMemo, useState, type RefObject } from 'react';
/* eslint-disable @typescript-eslint/no-misused-promises */
import styled from 'styled-components';
import fetch from 'node-fetch';
import pRetry from 'p-retry';
import { toNumber } from 'lodash';

import { z, zodSafeParse } from '../../../../util/zod';
import { SessionGifSearchInput } from './SessionGifSearchInput';
import { SessionSpinner } from '../../../loading';
import { getTriggerPosition, type PopoverTriggerPosition } from '../../../SessionTooltip';
import { useHasGiphyIntegrationEnabled } from '../../../../state/selectors/settings';
import { SessionPopoverContent } from '../../../SessionPopover';
import { SessionFocusTrap } from '../../../SessionFocusTrap';
import { IMAGE_GIF, VIDEO_MP4 } from '../../../../types/MIME';
import { useIsDarkTheme } from '../../../../state/theme/selectors/theme';
import { FetchDestination, insecureNodeFetch } from '../../../../session/utils/InsecureNodeFetch';
import { Constants } from '../../../../session';

type WithSelectGif = {
  selectGif: (gif: ArrayBuffer, gifId: string) => void;
};

type WithGifStartDownload = {
  onGifStartDownload: () => void;
};

type WithPreviewWidthAndHeight = {
  previewWidth: number;
  previewHeight: number;
};

type WithFetchOriginal = {
  fetchOriginal: () => Promise<ArrayBuffer | null>;
};

type WithFetchPreview = {
  fetchPreview: () => Promise<ArrayBuffer | null>;
};

type WithGifId = {
  gifId: string;
};

// use types from https://developers.giphy.com/docs/api/schema/#image-object
const gifSchema = z.object({
  id: z.string(),
  images: z.object({
    /**
     * Data on a version of this GIF downsized to be under 8mb
     */
    downsized_large: z.object({
      url: z.string(),
      size: z.string().transform(toNumber),
      width: z.string().transform(toNumber),
      height: z.string().transform(toNumber),
    }),
    /**
     * Data on a version of this GIF downsized to be under 2mb.
     */
    downsized: z.object({
      url: z.string(),
      size: z.string().transform(toNumber),
      width: z.string().transform(toNumber),
      height: z.string().transform(toNumber),
    }),
    /**
     * Data on a version of this GIF in .MP4 format limited to 50kb that displays the first 1-2 seconds of the GIF.
     */
    preview: z.object({
      mp4: z.string(),
      mp4_size: z.string().transform(toNumber),
      width: z.string().transform(toNumber),
      height: z.string().transform(toNumber),
    }),
  }),
});

const giphyBodySchema = z.object({
  data: z.array(gifSchema),
});

const GIF_PANEL_WIDTH_PX = 600;
const GIF_PANEL_HEIGHT_PX = 500;

export const StyledGifPanel = styled.div`
  display: flex;
  flex-direction: column;
  z-index: 5;
  width: ${GIF_PANEL_WIDTH_PX - 30}px;
  height: ${GIF_PANEL_HEIGHT_PX - 10}px;
  max-height: calc(100vh - 120px);

  button:focus {
    outline: none;
  }
`;

const StyledGifGrid = styled.div<{ $loading: boolean }>`
  height: 100%;
  width: 100%;
  overflow-y: scroll;
  display: flex;
  flex-grow: 1;
  gap: var(--margins-sm);
  ${props => props.$loading && 'justify-content: center; align-items: center;;'}
`;

function getGiphyAPIKey() {
  const apiKey = window.getGiphyApiKey();
  if (!apiKey) {
    throw new Error('SESSION_GIPHY_API_KEY is not set');
  }
  return apiKey;
}

function getGiphyLimit() {
  return 20;
}

// function getPingbackID() {
//   const pingbackID = process.env.SESSION_GIPHY_PINGBACK_ID;
//   if (!pingbackID) {
//     window.log.warn('SESSION_GIPHY_PINGBACK_ID is not set');
//     throw new Error('SESSION_GIPHY_PINGBACK_ID is not set');
//   }
//   return pingbackID;
// }

async function fetchGifs(searchTerm: string = '') {
  // &pingback_id=18dcdd3b1357ff91
  const endpoint = searchTerm ? 'search' : 'trending';
  const urlSearchParams = new URLSearchParams({
    rating: 'pg-13',
    offset: '0',
    limit: getGiphyLimit().toString(),
    api_key: getGiphyAPIKey(),
    ...(searchTerm ? { q: searchTerm } : {}),
  });
  const url = `https://api.giphy.com/v1/gifs/${endpoint}?${urlSearchParams}`;

  const res = await insecureNodeFetch({
    url,
    caller: 'fetchGifs',
    destination: FetchDestination.PUBLIC,
    fetchOptions: {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'WhatsApp',
      },
      signal: null,
      timeout: 10000,
    },
  });

  const json = await res.json();
  const parsed = zodSafeParse(giphyBodySchema, json);
  if (!parsed.success) {
    window.log.error(`Failed to parse giphy response`);
    window.log.debug(`Failed to parse giphy response: ${parsed.error.message}`);
    return [];
  }
  window.log.debug(
    `Found ${parsed.data.data.length} gifs for searchTerm:"${searchTerm}" endpoint:"${endpoint}"`
  );
  const body = parsed.data;
  const gifsToFetch: Array<Gif> = body.data.map(gif => {
    return {
      id: gif.id,
      previewWidth: gif.images.preview.width,
      previewHeight: gif.images.preview.height,
      fetchOriginal: () => {
        // look for an original gif less than 1MB in size
        if (gif.images.downsized_large.size < 1 * Constants.FILESIZE.MB) {
          window.log.debug(
            `Downloading downsized_large gif of size ${gif.images.downsized_large.size}`
          );
          return fetchGifBuffer(gif.images.downsized_large.url, IMAGE_GIF);
        }
        window.log.debug(`Downloading downsized gif of size ${gif.images.downsized.size}`);

        return fetchGifBuffer(gif.images.downsized.url, IMAGE_GIF);
      },
      fetchPreview: () => fetchGifBuffer(gif.images.preview.mp4, VIDEO_MP4),
    };
  });

  return gifsToFetch;
}

const StyledPoweredByGiphy = styled.div`
  display: flex;
  justify-content: center;
  margin-top: var(--margins-sm);
  margin-bottom: var(--margins-xs);
`;

const StyledPoweredByGiphyImg = styled.img`
  width: 33%;
`;

function PoweredByGiphy() {
  const isDarkTheme = useIsDarkTheme();
  return (
    <StyledPoweredByGiphy>
      <StyledPoweredByGiphyImg
        src={isDarkTheme ? 'images/powered-by-giphy-light.png' : 'images/powered-by-giphy-dark.png'}
      />
    </StyledPoweredByGiphy>
  );
}

export function SessionGifPanel({
  onChoseAttachments,
  closeGifPicker,
  show,
  buttonRef,
}: {
  onChoseAttachments: (newAttachments: Array<File>) => void;
  show: boolean;
  closeGifPicker: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const [gifs, setGifs] = useState<Array<Gif>>([]);
  const [loading, setLoading] = useState(false);

  const selectGif = async (gif: ArrayBuffer, gifId: string) => {
    window.log.debug('gif selected of size', gif.byteLength);
    const file = new File([gif], `gif-${gifId}.gif`, { type: IMAGE_GIF });
    onChoseAttachments([file]);
    closeGifPicker();
  };

  useEffect(() => {
    // eslint-disable-next-line more/no-then
    void fetchGifs().then(setGifs);
  }, []);

  const searchForGif = async (searchTerm: string) => {
    // eslint-disable-next-line more/no-then
    setLoading(true);
    try {
      const fetched = await fetchGifs(searchTerm);
      setGifs(fetched);
    } catch (e) {
      window.log.error(e);
    } finally {
      setLoading(false);
    }
  };

  const hasGiphyIntegrationEnabled = useHasGiphyIntegrationEnabled();

  if (!hasGiphyIntegrationEnabled) {
    return null;
  }

  const triggerPosition: PopoverTriggerPosition | null = show
    ? getTriggerPosition(buttonRef)
    : null;

  return (
    <SessionPopoverContent
      triggerPosition={triggerPosition}
      open={!!triggerPosition}
      isTooltip={true}
      verticalPosition="top"
      horizontalPosition="center"
      fallbackContentWidth={GIF_PANEL_WIDTH_PX}
      fallbackContentHeight={GIF_PANEL_HEIGHT_PX}
    >
      <SessionFocusTrap
        focusTrapId="gif-search"
        escapeDeactivates={true}
        onDeactivate={closeGifPicker}
        clickOutsideDeactivates={true}
      >
        <StyledGifPanel>
          <SessionGifSearchInput search={searchForGif} />
          <GifGrid selectGif={selectGif} providedGifs={gifs} loading={loading} />
          <PoweredByGiphy />
        </StyledGifPanel>
      </SessionFocusTrap>
    </SessionPopoverContent>
  );
}

type Gif = WithPreviewWidthAndHeight &
  WithFetchOriginal &
  WithFetchPreview & {
    id: string;
  };

async function fetchGifBuffer(url: string, contentType: string) {
  try {
    const fetchedContent = pRetry(
      async () => {
        const response = await fetch(url, {
          headers: {
            'Content-Type': contentType,
          },
          timeout: 10000,
        });

        if (!response.ok) {
          throw new Error(`Failed to download gif buffer ${url} ${contentType}`);
        }

        const arr = await response.arrayBuffer();
        // window.log.debug(
        //   `fetchGifBuffer ${url} returned ${response.status} with size:${arr.byteLength}`
        // );
        if (arr.byteLength === 0) {
          throw new Error(`Failed to download gif buffer ${url} ${contentType}`);
        }
        return arr;
      },
      {
        onFailedAttempt: error => {
          window.log.error(
            `Failed to download gif buffer ${url} ${contentType} attempt:${error.attemptNumber}, retriesLeft:${error.retriesLeft}`,
            error.message
          );
        },
        retries: 3,
      }
    );

    return fetchedContent;
  } catch (e) {
    window.log.error(`Failed to download gif buffer ${url} ${contentType}`, e);
    return null;
  }
}

const StyledGifColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 50%;
  gap: var(--margins-sm);
`;

function GifColumn({
  gifs,
  selectGif,
  onGifStartDownload,
}: WithSelectGif &
  WithGifStartDownload & {
    gifs: Array<Gif>;
  }) {
  return (
    <StyledGifColumn>
      {gifs.map(gif => {
        const { id } = gif;
        return (
          <GifItem
            key={id}
            {...gif}
            gifId={gif.id}
            selectGif={selectGif}
            onGifStartDownload={onGifStartDownload}
          />
        );
      })}
    </StyledGifColumn>
  );
}

function GifGrid({
  selectGif,
  providedGifs,
  loading,
}: WithSelectGif & {
  providedGifs: Array<Gif>;
  loading: boolean;
}) {
  const [gifDownloading, setGifDownloading] = useState(false);

  const { leftSideGifs, rightSideGifs } = useMemo(() => {
    const left: Array<Gif> = [];
    const right: Array<Gif> = [];
    let leftHeight = 0;
    let rightHeight = 0;
    for (const gif of providedGifs) {
      const renderedHeight = gif.previewHeight / gif.previewWidth;
      if (leftHeight <= rightHeight) {
        left.push(gif);
        leftHeight += renderedHeight;
      } else {
        right.push(gif);
        rightHeight += renderedHeight;
      }
    }
    return { leftSideGifs: left, rightSideGifs: right };
  }, [providedGifs]);

  function onGifStartDownload() {
    setGifDownloading(true);
  }

  const mergedLoading = loading || gifDownloading;

  if (mergedLoading) {
    return (
      <StyledGifGrid $loading={mergedLoading}>
        <SessionSpinner $loading={mergedLoading} />
      </StyledGifGrid>
    );
  }

  return (
    <StyledGifGrid $loading={loading}>
      <GifColumn
        gifs={leftSideGifs}
        selectGif={selectGif}
        onGifStartDownload={onGifStartDownload}
      />
      <GifColumn
        gifs={rightSideGifs}
        selectGif={selectGif}
        onGifStartDownload={onGifStartDownload}
      />
    </StyledGifGrid>
  );
}

const StyledButton = styled.button`
  width: 100%;
  display: block;
`;

const StyledLoadingPlaceholderContainer = styled.div<{ $aspectRatio: number }>`
  width: 100%;
  aspect-ratio: ${props => props.$aspectRatio};
  display: flex;
  justify-content: center;
  align-items: center;
`;

const StyledVideo = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
`;

const GifItem = ({
  fetchOriginal,
  fetchPreview,
  selectGif,
  previewHeight,
  previewWidth,
  onGifStartDownload,
  gifId,
}: WithSelectGif &
  WithGifStartDownload &
  WithPreviewWidthAndHeight &
  WithFetchOriginal &
  WithFetchPreview &
  WithGifId) => {
  const [preview, setPreview] = useState<ArrayBuffer | null>(null);
  const blobUrlPreview = useMemo(() => {
    if (!preview) {
      return null;
    }
    return URL.createObjectURL(new Blob([preview], { type: VIDEO_MP4 }));
  }, [preview]);

  useEffect(() => {
    async function localFn() {
      const fetched = await fetchPreview();
      if (fetched) {
        setPreview(fetched);
      }
    }
    void localFn();
  }, [fetchPreview]);

  if (!blobUrlPreview) {
    const aspectRatio = previewWidth / previewHeight;
    return (
      <StyledLoadingPlaceholderContainer $aspectRatio={aspectRatio}>
        <SessionSpinner $loading={true} />
      </StyledLoadingPlaceholderContainer>
    );
  }

  return (
    <StyledButton
      onClick={async () => {
        onGifStartDownload();
        const fetched = await fetchOriginal();
        if (fetched) {
          selectGif(fetched, gifId);
        }
      }}
      style={{ height: blobUrlPreview ? '' : previewHeight }}
    >
      <StyledVideo controls={false} autoPlay={true} loop={true}>
        <source src={blobUrlPreview} />
      </StyledVideo>
    </StyledButton>
  );
};
