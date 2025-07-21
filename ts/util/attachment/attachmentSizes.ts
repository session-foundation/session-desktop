import { FILESIZE } from '../../session/constants';

export const ATTACHMENT_DEFAULT_MAX_SIDE = 4096;

export const maxAvatarDetails = {
  maxSide: 200,
  maxSize: 5 * FILESIZE.MB,
};

export const maxThumbnailDetails = {
  maxSide: 200,
  maxSize: 200 * 1000, // 200 ko
};
