import type sharp from 'sharp';

type WithIsAnimated = {
  isAnimated: boolean;
};

type WithSharpFormat = Pick<sharp.Metadata, 'format'>;
type WithSharpSize = Required<Pick<sharp.Metadata, 'size'>>;
type WithSharpWidth = Pick<sharp.Metadata, 'width'>;
type WithSharpHeight = Pick<sharp.Metadata, 'height'>;
type WithOutputBuffer = { outputBuffer: ArrayBufferLike };

type WithCustomSharpFormat<T extends keyof sharp.format> = { format: T };

type WithImageFormat<T extends 'jpeg' | 'png' | 'webp'> = WithCustomSharpFormat<T> & {
  contentType: `image/${T}`;
};

type WithJpegFormat = WithImageFormat<'jpeg'>;
type WithPngFormat = WithImageFormat<'png'>;
type WithWebpFormat = WithImageFormat<'webp'>;

/**
 * The output of a always static output image.
 */
type StaticOutputType = WithOutputBuffer & WithSharpSize & WithSharpWidth & WithSharpHeight;

/**
 * Can be animated or not
 */
type MaybeAnimatedOutputType = StaticOutputType & WithIsAnimated;

export type ProcessedLocalAvatarChangeType = Awaited<
  ReturnType<ImageProcessorWorkerActions['processLocalAvatarChange']>
>;

export type ImageProcessorWorkerActions = {
  extractFirstFrameJpeg: (input: ArrayBufferLike) => Promise<StaticOutputType & WithJpegFormat>;

  /**
   * Process a local avatar change.
   * This function will generate a mainAvatar, and a fallbackAvatar if needed.
   *
   * The mainAvatar can be animated or not. If animated it is a webp, if not it is a jpeg.
   * The fallbackAvatar, if set, it is a always a jpeg.
   */
  processLocalAvatarChange: (
    input: ArrayBufferLike,
    maxSidePx: number
  ) => Promise<{
    mainAvatarDetails: MaybeAnimatedOutputType & (WithWebpFormat | WithJpegFormat);
    avatarFallback: (StaticOutputType & WithJpegFormat) | null;
  }>;

  /**
   * Process an image to get a thumbnail matching our required details for link previews
   * A link preview thumbnail is always a png, and resized to "contain" the image.
   */
  processForLinkPreviewThumbnail: (
    input: ArrayBufferLike,
    maxSidePx: number
  ) => Promise<StaticOutputType & WithPngFormat>;

  /**
   * Process an image to get a thumbnail matching our required details for in conversation thumbnails
   * This is about the thumbnail in the conversation list (for attachments in messages). We generate a preview to avoid loading huge files until we show them in fullscreen.
   *
   * Note: an animated image or not animated will always be returned as a jpeg. Otherwise a png will be returned.
   * Note: eventually we want to support animated images as previews too. When we do, we will need to
   * convert them to webp and resize their preview heavily for performance reasons.
   * A in conversation thumbnail is always resized to "fill" the image.
   */
  processForInConversationThumbnail: (
    input: ArrayBufferLike,
    maxSidePx: number
  ) => Promise<MaybeAnimatedOutputType & (WithWebpFormat | WithPngFormat)>;

  /**
   * Process an image to get something that we can upload to the file server.
   * This is only used for attachments, as avatars have a lot tighter requirements.
   *
   * If
   *  - not an image, or
   *  - not one we can process (i.e enforced lossless),
   *  - or we cannot get an image small enough after dropping the quality
   * null will be returned. The caller should check if the requirements are met before trying to upload.
   *
   * The caller should check that the requirements have been met before trying to upload.
   *
   * Note: the lossy formats are jpeg, webp and avif.
   * Anything else that is an image supported by sharp will only be scaled down to maxSidePx.
   * Anything else not an image supported by sharp will return null
   *
   * @param input: the image data to process
   * @param maxSidePx: we cap an image to this size. If the image is larger, it will be scaled down to this before we start dropping the quality.
   * @param maxSizeBytes: loop dropping the quality until we get a file under this size. (binary approach)
   */
  processForFileServerUpload: (
    input: ArrayBufferLike,
    maxSidePx: number,
    maxSizeBytes: number
  ) => Promise<null | (MaybeAnimatedOutputType & WithSharpFormat)>;

  /**
   * Utility function to generate a fake avatar for testing purposes.
   * The background is a color, and the avatar is always a jpeg.
   */
  testIntegrationFakeAvatar: (
    maxSidePx: number,
    background: { r: number; g: number; b: number } // { r: 0, g: 0, b: 255 } for fully blue
  ) => Promise<MaybeAnimatedOutputType & WithJpegFormat>;

  /**
   * Extract the metadata retrieved from the image
   */
  imageMetadata: (input: ArrayBufferLike) => Promise<Omit<MaybeAnimatedOutputType, 'outputBuffer'>>;
};
