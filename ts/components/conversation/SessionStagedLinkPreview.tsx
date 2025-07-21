import { AbortSignal } from 'abort-controller';
import insecureNodeFetch from 'node-fetch';
import { StagedLinkPreviewData } from './composition/CompositionBox';

import { AttachmentUtil, LinkPreviewUtil } from '../../util';
import { fetchLinkPreviewImage } from '../../util/linkPreviewFetch';
import { LinkPreviews } from '../../util/linkPreviews';
import { StagedLinkPreview } from './StagedLinkPreview';
import type { BetterBlob } from '../../util/attachment/attachmentsUtil';
import { fromArrayBufferToBase64 } from '../../session/utils/String';

export interface StagedLinkPreviewProps extends StagedLinkPreviewData {
  onClose: (url: string) => void;
}
export const LINK_PREVIEW_TIMEOUT = 20 * 1000;

export interface GetLinkPreviewResult {
  title: string;
  url: string;
  image?: BetterBlob;
  imageData?: string;
  date: number | null;
}

export const getPreview = async (
  url: string,
  abortSignal: AbortSignal
): Promise<null | GetLinkPreviewResult> => {
  // This is already checked elsewhere, but we want to be extra-careful.
  if (!LinkPreviews.isLinkSafeToPreview(url)) {
    throw new Error('Link not safe for preview');
  }

  window?.log?.info('insecureNodeFetch => plaintext for getPreview()');

  const linkPreviewMetadata = await LinkPreviewUtil.fetchLinkPreviewMetadata(
    insecureNodeFetch,
    url,
    abortSignal
  );
  if (!linkPreviewMetadata) {
    throw new Error('Could not fetch link preview metadata');
  }
  const { title, imageHref, date } = linkPreviewMetadata;

  let image: BetterBlob | undefined;
  if (imageHref && LinkPreviews.isLinkSafeToPreview(imageHref)) {
    try {
      window?.log?.info('insecureNodeFetch => plaintext for getPreview()');

      const fullSizeImage = await fetchLinkPreviewImage(insecureNodeFetch, imageHref, abortSignal);
      if (!fullSizeImage) {
        throw new Error('Failed to fetch link preview image');
      }

      // Ensure that this file is either small enough or is resized to meet our
      //   requirements for attachments
      image = await AttachmentUtil.autoScaleForThumbnailArrayBuffer(fullSizeImage.data);
    } catch (error) {
      // We still want to show the preview if we failed to get an image
      window?.log?.error('getPreview failed to get image for link preview:', error.message);
    }
  }

  const arrayBuffer = await image?.arrayBuffer();
  const imageData = arrayBuffer
    ? `data:image/jpeg;base64, ${fromArrayBufferToBase64(arrayBuffer)}`
    : undefined;

  return {
    title,
    url,
    image,
    imageData,
    date,
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
      image={props.image}
      imageData={props.imageData}
    />
  );
};
