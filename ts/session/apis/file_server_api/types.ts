import {
  extractDetailsFromUrlFragment,
  extractLastPathSegment,
  parseFileServerUrl,
} from '../../url';
import type { FILE_SERVER_TARGET_TYPE } from './FileServerTarget';

export function fileServerUrlToFileId(fullURL?: string) {
  const parsedUrl = parseFileServerUrl(fullURL);
  if (!parsedUrl) {
    return { fileId: '', fullUrl: null };
  }
  const fileId = extractLastPathSegment(parsedUrl);

  if (!fileId) {
    return { fileId: '', fullUrl: null };
  }
  return { fileId, fullUrl: parsedUrl };
}

function getDownloadFileDetails(urlWithFragment: string) {
  const { fileId, fullUrl } = fileServerUrlToFileId(urlWithFragment);
  if (!fileId || !fullUrl) {
    throw new Error('DownloadFromFileServer: fileId is empty or not a file server url');
  }

  const { serverEd25519Pk, deterministicEncryption } = extractDetailsFromUrlFragment(fullUrl);

  return { fileId, fullUrl, serverEd25519Pk, deterministicEncryption };
}

function getUploadFileDetails(urlWithServerPk: string) {
  const fullUrl = parseFileServerUrl(urlWithServerPk);
  if (!fullUrl) {
    throw new Error('DownloadFromFileServer: fullUrl cannot be parsed');
  }

  const { serverEd25519Pk, deterministicEncryption } = extractDetailsFromUrlFragment(fullUrl);

  return { fullUrl, serverEd25519Pk, deterministicEncryption };
}

/**
 * A utility class to store a file that needs to be downloaded from a file server.
 * It validates that the url is one of the valid file server urls.
 * Throws if the url is not valid or not a file server url.
 */
export class FileFromFileServerDetails {
  public readonly fileId: string;
  public readonly fullUrl: URL;
  public readonly serverEd25519Pk: string;
  public readonly deterministicEncryption: boolean;

  /**
   * Construct a FileFromFileServer object.
   * @param url the url to download from. It must have the serverPubkey as a query parameter (serverPubkey)
   */
  constructor(url: string) {
    const { fileId, fullUrl, serverEd25519Pk, deterministicEncryption } =
      getDownloadFileDetails(url);

    this.fileId = fileId;
    this.fullUrl = fullUrl;
    this.serverEd25519Pk = serverEd25519Pk;
    this.deterministicEncryption = deterministicEncryption;
  }
}

/**
 * A utility class to store a file that needs to be uploaded to a file server.
 */
export class UploadToFileServerDetails {
  public readonly data: ArrayBuffer;
  public readonly deterministicEncryption: boolean;
  public readonly target: FILE_SERVER_TARGET_TYPE;

  /**
   * Construct a UploadToFileServerDetails object
   */
  constructor({
    data,
    target,
    deterministicEncryption,
  }: {
    data: ArrayBuffer;
    target: FILE_SERVER_TARGET_TYPE;
    deterministicEncryption: boolean;
  }) {
    this.target = target;
    this.data = data;
    this.deterministicEncryption = deterministicEncryption;
    // Note the ed/x pk is deduced from the target itself
  }
}

/**
 * A utility class to store a file that needs to be downloaded from a file server.
 * It validates that the url is one of the valid file server urls.
 * Throws if the url is not valid or not a file server url.
 */
export class FileToFileServerDetails {
  public readonly fullUrl: URL;
  public readonly serverEd25519Pk: string;

  /**
   * Construct a FileFromFileServer object.
   * @param url the url to download from. It must have the serverPubkey as a query parameter (serverPubkey)
   */
  constructor(url: string) {
    const { fullUrl, serverEd25519Pk } = getUploadFileDetails(url);

    this.fullUrl = fullUrl;
    this.serverEd25519Pk = serverEd25519Pk;
  }
}

export type UrlWithFragment = string & {
  __brand: 'UrlWithFragment';
};
