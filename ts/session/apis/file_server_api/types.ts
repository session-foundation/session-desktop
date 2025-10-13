import {
  extractDetailsFromUrlFragment,
  extractLastPathSegment,
  parseFileServerUrl,
} from '../../url';

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
