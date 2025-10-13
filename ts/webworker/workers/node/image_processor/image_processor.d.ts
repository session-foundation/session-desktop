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

type WithImageFormat<T extends 'jpeg' | 'png' | 'webp' | 'gif'> = WithCustomSharpFormat<T> & {
  contentType: `image/${T}`;
};

type WithWebpFormat = WithImageFormat<'webp'>;
type WithGifFormat = WithImageFormat<'gif'>;

/**
 * The output of a always static output image.
 */
type StaticOutputType = WithOutputBuffer &
  WithSharpSize &
  WithSharpWidth &
  WithSharpHeight &
  WithSharpFormat;

/**
 * Can be animated or not. Another `With` will be needed to express the type of the content.
 */
type MaybeAnimatedOutputType = StaticOutputType & WithIsAnimated;

export type ProcessedAvatarDataType = NonNullable<
  Awaited<ReturnType<ImageProcessorWorkerActions['processAvatarData']>>
>;

export type ProcessedLinkPreviewThumbnailType = NonNullable<
  Awaited<ReturnType<ImageProcessorWorkerActions['processForLinkPreviewThumbnail']>>
>;

export type ImageProcessorWorkerActions = {
  /**
   * Process an avatar. Depending on if we want this to be reuploaded or not, we allow gif as a return format or not.
   * The reason is that when we plan for reupload, we don't convert gif to webp, as we want to keep the original gif.
   * When the change is not planned for reupload, we convert everything to a webp.
   * This function will generate a mainAvatar, and a fallbackAvatar if needed.
   *
   * The mainAvatar can be animated or not.
   *  - If animated it is an animated webp (always),
   *  - If not, it is a static webp.
   * The fallbackAvatar, if set, is always a static webp.
   *
   * planForReupload must be true when
   *  - for our own avatar (changed by the current user, locally or not)
   *  - for our own avatar (automatic reupload)
   *  - (later: for a groupv2 avatar: locally or not and on reupload, even if we are not an admin (as we might become one)
   */
  processAvatarData: (
    input: ArrayBufferLike,
    planForReupload: boolean
  ) => Promise<{
    mainAvatarDetails: Omit<MaybeAnimatedOutputType, 'format'> & WithImageFormat<'gif' | 'webp'>;
    avatarFallback: (StaticOutputType & WithWebpFormat) | null;
  } | null>;

  /**
   * Process an image to get a thumbnail matching our required details for link previews
   * A link preview thumbnail is always a png, and resized to "cover".
   */
  processForLinkPreviewThumbnail: (
    input: ArrayBufferLike,
    maxSidePx: number
  ) => Promise<(StaticOutputType & WithWebpFormat) | null>;

  /**
   * Process an image to get a thumbnail matching our required details for in conversation thumbnails
   * This is about the thumbnail in the conversation list (for attachments in messages). We generate a preview to avoid loading huge files until we show them in fullscreen.
   *
   * Note: animated or not, an image will always be returned as a webp.
   * A 'in conversation thumbnail' is always resized to "cover" and enlarged if it was smaller than maxSidePx.
   */
  processForInConversationThumbnail: (
    input: ArrayBufferLike,
    maxSidePx: number
  ) => Promise<(Omit<MaybeAnimatedOutputType, 'format'> & WithWebpFormat) | null>;

  /**
   * Process an image to get something that we can upload to the file server.
   * This is only used for attachments, as avatars have a lot tighter requirements.
   *
   * If
   *  - not an image, or
   *  - not one we can process (i.e enforced lossless),
   *  - or we cannot get an image small enough after dropping the quality
   * null will be returned.
   * The caller should always check if the requirements are met before trying to upload.
   *
   * Note: the lossy formats are jpeg, webp and avif.
   * Anything else that is an image supported by sharp will only be scaled down to maxSidePx.
   * Anything else not an image supported by sharp will return null.
   *
   * To make it clear,
   * - if the image is **lossy** and already fits the requirements, we return it as is.
   * - if the image is **lossless**:
   *  - if it fits the requirements, we return it as is (not even scaled down, as we'd need a loader in the staged attachments list to display the loading state)
   *  - if it does not fit the requirements, we return null
   * - if the image is **lossy** and doesn't fit:
   *  - we first scale it down the maxSize, and then iterate over the quality to get something that fits the maxSizeBytes.
   *  - if we cannot get a file under maxSizeBytes, we return null
   *
   *
   * @param input: the image data to process
   * @param maxSidePx: we cap an image to this size. If the image is larger, it will be scaled down to this before we start dropping the quality.
   * @param maxSizeBytes: loop dropping the quality until we get a file under this size. (binary approach)
   */
  processForFileServerUpload: (
    input: ArrayBufferLike,
    maxSidePx: number,
    maxSizeBytes: number
  ) => Promise<null | MaybeAnimatedOutputType>;

  /**
   * Utility function to generate a fake avatar for testing purposes.
   * The background is a color, and the avatar is always a jpeg.
   */
  testIntegrationFakeAvatar: (
    maxSidePx: number,
    background: { r: number; g: number; b: number } // { r: 0, g: 0, b: 255 } for fully blue
  ) => Promise<Omit<MaybeAnimatedOutputType, 'format'> & WithWebpFormat>;

  /**
   * Extract the metadata retrieved from the image.
   * Returns null if sharp cannot part the buffer at all.
   */
  imageMetadata: (
    input: ArrayBufferLike
  ) => Promise<Omit<MaybeAnimatedOutputType, 'outputBuffer'> | null>;
};
