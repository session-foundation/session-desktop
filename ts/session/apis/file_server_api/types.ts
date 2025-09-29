import { FILE_SERVERS } from './FileServerApi';

/**
 * Returns the parsed url from the provided string only if that matches one of our file server urls.
 */
function parseFileServerUrl(fullURL?: string) {
  if (!fullURL) {
    return null;
  }

  const parsedUrl = URL.canParse(fullURL) && new URL(fullURL);
  if (!parsedUrl) {
    return null;
  }

  if (!parsedUrl.host.includes('getsession.org')) {
    return null;
  }

  if (parsedUrl.host.includes('open.getsession.org')) {
    // we need to filter out communities we host on getsession.org as they do not have the same api.
    return null;
  }
  return parsedUrl;
}

export const queryParamServerPubkey = 'serverPubkey';

/**
 * Returns the serverPk from the provided url.
 * Note:
 * - for the default file server, the serverPk is hardcoded.
 * - if no serverPk is provided, the defaultFileServerPubKey is returned.
 *
 */
function extractServerPk(url: URL) {
  if (url.origin === FILE_SERVERS.DEFAULT.url) {
    return FILE_SERVERS.DEFAULT.pubkey;
  }
  const serverPk = url.searchParams.get(queryParamServerPubkey);
  if (serverPk) {
    return serverPk;
  }
  throw new Error(
    'FileFromFileServer: serverPubkey is required as a query parameter for non-default file server'
  );
}

function extractFileID(url: URL) {
  const lastSegment = url.pathname.split('/').filter(Boolean).pop();
  if (!lastSegment) {
    return null;
  }
  return lastSegment;
}

export function fileServerUrlToFileId(fullURL?: string) {
  const parsedUrl = parseFileServerUrl(fullURL);
  if (!parsedUrl) {
    return { fileId: '', fullUrl: null };
  }
  const fileId = extractFileID(parsedUrl);

  if (!fileId) {
    return { fileId: '', fullUrl: null };
  }
  return { fileId, fullUrl: parsedUrl };
}

function getDownloadFileDetails(urlWithFileIdAndServerPk: string) {
  const { fileId, fullUrl } = fileServerUrlToFileId(urlWithFileIdAndServerPk);
  if (!fileId || !fullUrl) {
    throw new Error('DownloadFromFileServer: fileId is empty or not a file server url');
  }

  const serverPk = extractServerPk(fullUrl);

  return { fileId, fullUrl, serverPk };
}

function getUploadFileDetails(urlWithServerPk: string) {
  const fullUrl = parseFileServerUrl(urlWithServerPk);
  if (!fullUrl) {
    throw new Error('DownloadFromFileServer: fullUrl cannot be parsed');
  }

  const serverPk = extractServerPk(fullUrl);

  return { fullUrl, serverPk };
}

/**
 * A utility class to store a file that needs to be downloaded from a file server.
 * It validates that the url is one of the valid file server urls.
 * Throws if the url is not valid or not a file server url.
 */
export class FileFromFileServerDetails {
  public readonly fileId: string;
  public readonly fullUrl: URL;
  public readonly serverPubkey: string;

  /**
   * Construct a FileFromFileServer object.
   * @param url the url to download from. It must have the serverPubkey as a query parameter (serverPubkey)
   */
  constructor(url: string) {
    const { fileId, fullUrl, serverPk } = getDownloadFileDetails(url);

    this.fileId = fileId;
    this.fullUrl = fullUrl;
    this.serverPubkey = serverPk;
  }
}

/**
 * A utility class to store a file that needs to be downloaded from a file server.
 * It validates that the url is one of the valid file server urls.
 * Throws if the url is not valid or not a file server url.
 */
export class FileToFileServerDetails {
  public readonly fullUrl: URL;
  public readonly serverPubkey: string;

  /**
   * Construct a FileFromFileServer object.
   * @param url the url to download from. It must have the serverPubkey as a query parameter (serverPubkey)
   */
  constructor(url: string) {
    const { fullUrl, serverPk } = getUploadFileDetails(url);

    this.fullUrl = fullUrl;
    this.serverPubkey = serverPk;
  }
}
