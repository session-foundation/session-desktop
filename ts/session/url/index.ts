import { FS } from '../apis/file_server_api/FileServerTarget';

export const queryParamServerEd25519Pubkey = 'p';
export const queryParamDeterministicEncryption = 'd';
/**
 * The encryption key is a hex string, and was used to encrypt the file.
 * It is the same as the profileKey for a user profile.
 */
export const queryParamEncryptionKey = 'e';

function parseSearchParamsFromFragment(url: URL) {
  // slice to remove the leading '#'
  const fragment = (url.hash || '').slice(1);

  const searchParams = new URLSearchParams(fragment);
  return searchParams;
}

/**
 * Returns the serverPk/deterministicEncryption/profileKey from the provided url fragment
 * Note:
 * - for the default file server, the serverPk is hardcoded.
 * - if no serverPk is provided, the defaultFileServerPubKey is returned.
 * - if no profileKey is provided, the profileKey is null
 * - if no deterministicEncryption is provided, the deterministicEncryption is false (presence is used, the value is not checked)
 *
 * Also, the fs serverPk is removed from the url if it is the default one.
 */
export function extractDetailsFromUrlFragment(url: URL) {
  const searchParams = parseSearchParamsFromFragment(url);
  // if the serverPk is not present in the fragment, we assume it is the default file server
  const serverEd25519Pk =
    searchParams.get(queryParamServerEd25519Pubkey) ?? FS.FILE_SERVERS.DEFAULT.edPk;
  const profileKey = searchParams.get(queryParamEncryptionKey);
  const deterministicEncryption = searchParams.has(queryParamDeterministicEncryption) ?? false;
  if (!serverEd25519Pk) {
    throw new Error(
      'FileFromFileServer: serverPubkey & other details are required as a fragment-query parameter for non-default file server'
    );
  }

  return {
    serverEd25519Pk,
    deterministicEncryption,
    profileKey,
    urlWithoutProfileKey: removeDefaultServerPk(removeProfileKey(url)).toString(),
  };
}

export function addProfileKeyToUrl(url: URL, profileKeyHex: string) {
  const searchParams = parseSearchParamsFromFragment(url);
  const profileKey = searchParams.get(queryParamEncryptionKey);
  if (profileKey) {
    // a profile key field is already present
    return url;
  }
  const urlCopy = new URL(url.toString());
  searchParams.set(queryParamEncryptionKey, profileKeyHex);
  urlCopy.hash = searchParams.toString() ?? '';

  return urlCopy;
}

function removeProfileKey(url: URL) {
  const searchParams = parseSearchParamsFromFragment(url);
  const profileKey = searchParams.get(queryParamEncryptionKey);
  if (!profileKey) {
    // a profile key field is not present
    return url;
  }
  const urlCopy = new URL(url.toString());
  searchParams.delete(queryParamEncryptionKey);
  urlCopy.hash = searchParams.toString() ?? '';

  return urlCopy;
}

function removeDefaultServerPk(url: URL) {
  const searchParams = parseSearchParamsFromFragment(url);
  const serverPk = searchParams.get(queryParamServerEd25519Pubkey);
  if (!serverPk || !FS.isDefaultFileServer(serverPk)) {
    // a serverPk is not present, or it is not the default file server
    return url;
  }

  const urlCopy = new URL(url.toString());
  searchParams.delete(queryParamEncryptionKey);
  urlCopy.hash = searchParams.toString() ?? '';

  return urlCopy;
}

export function extractLastPathSegment(url: URL) {
  const lastSegment = url.pathname.split('/').filter(Boolean).pop();
  if (!lastSegment) {
    return null;
  }
  return lastSegment;
}

/**
 * Returns the parsed url from the provided string only if that matches one of our file server urls.
 */
export function parseFileServerUrl(fullURL?: string) {
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
