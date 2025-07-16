export type ImageProcessorWorkerActions = {
  extractFirstFrame: (absolutePath: string) => Promise<ArrayBufferLike>;
  extractFirstFrameBuffer: (input: ArrayBufferLike) => Promise<ArrayBufferLike>;
  cropAnimatedAvatar: (
    input: ArrayBufferLike,
    maxSide: number
  ) => Promise<{ resizedBuffer: ArrayBufferLike; width: number; height: number }>;
};
