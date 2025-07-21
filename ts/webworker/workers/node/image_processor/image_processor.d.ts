import type sharp from 'sharp';

type WithIsAnimated = {
  isAnimated: boolean;
};

type WithSharpFormat = Pick<sharp.Metadata, 'format'>;
type WithSharpSize = Required<Pick<sharp.Metadata, 'size'>>;
type WithSharpWidth = Pick<sharp.Metadata, 'width'>;
type WithSharpHeight = Pick<sharp.Metadata, 'height'>;
type WithOutputBuffer = { outputBuffer: ArrayBufferLike };

/**
 * Can be animated or not, if animated enforced to be webp. If not, enforced to be jpeg.
 */
export type MainAvatarType = WithOutputBuffer &
  WithIsAnimated &
  WithSharpFormat &
  WithSharpSize &
  WithSharpWidth &
  WithSharpHeight;

/**
 * Never animated, enforced to be jpeg.
 */
export type FallbackAvatarType = WithOutputBuffer &
  WithSharpFormat &
  WithSharpSize &
  WithSharpWidth &
  WithSharpHeight;

export type ProcessedLocalAvatarChangeType = Awaited<
  ReturnType<ImageProcessorWorkerActions['processLocalAvatarChange']>
>;

export type ImageProcessorWorkerActions = {
  extractFirstFrameJpeg: (
    input: ArrayBufferLike
  ) => Promise<
    WithOutputBuffer & WithSharpSize & WithSharpWidth & WithSharpHeight & WithSharpFormat
  >;

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
    mainAvatarDetails: MainAvatarType;
    avatarFallback: FallbackAvatarType | null;
  }>;

  imageMetadata: (
    input: ArrayBufferLike
  ) => Promise<WithIsAnimated & WithSharpFormat & WithSharpSize & WithSharpWidth & WithSharpHeight>;
};
