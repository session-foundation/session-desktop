import AbortController from 'abort-controller';
import { isEmpty, isFinite, isNumber, isString } from 'lodash';

import { BlindingActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { OnionSending } from '../../onions/onionSend';
import {
  batchGlobalIsSuccess,
  parseBatchGlobalStatusCode,
} from '../open_group_api/sogsv3/sogsV3BatchPoll';
import { fromUInt8ArrayToBase64 } from '../../utils/String';
import { NetworkTime } from '../../../util/NetworkTime';
import { DURATION } from '../../constants';
import { isReleaseChannel, type ReleaseChannels } from '../../../updater/types';
import { Storage } from '../../../util/storage';
import { OnionV4 } from '../../onions/onionv4';
import { SERVER_HOSTS } from '..';
import { FileFromFileServerDetails, queryParamServerPubkey } from './types';

const defaultFileServerURL = `http://${SERVER_HOSTS.DEFAULT_FILE_SERVER}`;
const defaultFileServerPubKey = 'da21e1d886c6fbaea313f75298bd64aab03a97ce985b46bb2dad9f2089c8ee59';

export const FILE_SERVERS = {
  DEFAULT: { url: defaultFileServerURL, pubkey: defaultFileServerPubKey },
  POTATO: {
    url: 'http://potatofiles.getsession.org',
    // potato has the same pubkey as the default file server
    pubkey: defaultFileServerPubKey,
  },
};

export function fileServerQueryPubkey(serverPkHex: string) {
  return `?${queryParamServerPubkey}=${serverPkHex}`;
}

const RELEASE_VERSION_ENDPOINT = '/session_version';
const FILE_ENDPOINT = '/file';

/**
 * Upload a file to the file server v2 using the onion v4 encoding
 * @param fileContent the data to send
 * @returns null or the complete URL to share this file
 */
export const uploadFileToFsWithOnionV4 = async (
  fileContent: ArrayBuffer
): Promise<{ fileUrl: string; expiresMs: number; serverPubkey: string } | null> => {
  if (!fileContent || !fileContent.byteLength) {
    return null;
  }

  // TODO: remove this once QA is done
  const target = process.env.POTATO_FS ? 'POTATO' : 'DEFAULT';

  const result = await OnionSending.sendBinaryViaOnionV4ToFileServer({
    abortSignal: new AbortController().signal,
    bodyBinary: new Uint8Array(fileContent),
    target,
    endpoint: FILE_ENDPOINT,
    method: 'POST',
    timeoutMs: 30 * DURATION.SECONDS, // longer time for file upload
    headers: window.sessionFeatureFlags.fsTTL30s ? { 'X-FS-TTL': '30' } : {},
  });

  if (!batchGlobalIsSuccess(result)) {
    return null;
  }

  const fileId = result?.body?.id as string | undefined;
  const expires = result?.body?.expires as number; // expires is returned as a floating point timestamp in seconds, i.e. 1754863793.186137.
  if (
    !fileId ||
    !isString(fileId) ||
    isEmpty(fileId) ||
    !expires ||
    !isNumber(expires) ||
    !isFinite(expires)
  ) {
    return null;
  }
  const fileUrl = `${FILE_SERVERS[target].url}${FILE_ENDPOINT}/${fileId}`;
  const expiresMs = Math.floor(expires * 1000);
  return {
    fileUrl,
    expiresMs,
    serverPubkey: FILE_SERVERS[target].pubkey,
  };
};

/**
 * Download a file given the fileId from the fileserver
 * @param fileIdOrCompleteUrl the fileId to download or the completeUrl to the file itself
 * @returns the data as an Uint8Array or null
 */
export const downloadFileFromFileServer = async (
  toDownload: FileFromFileServerDetails
): Promise<ArrayBuffer | null> => {
  if (window.sessionFeatureFlags?.debugServerRequests) {
    window.log.info(`about to try to download fsv2: "${toDownload.fullUrl}"`);
  }

  // this throws if we get a 404 from the file server
  const result = await OnionSending.getBinaryViaOnionV4FromFileServer({
    abortSignal: new AbortController().signal,
    fileToGet: toDownload,
    throwError: true,
    timeoutMs: 30 * DURATION.SECONDS, // longer time for file download
  });
  if (window.sessionFeatureFlags?.debugServerRequests) {
    window.log.info(`download fsv2: "${toDownload.fullUrl} got result:`, JSON.stringify(result));
  }
  if (!result) {
    return null;
  }

  if (!batchGlobalIsSuccess(result)) {
    window.log.info(
      'download from fileserver failed with status ',
      parseBatchGlobalStatusCode(result)
    );
    return null;
  }

  const { bodyBinary } = result;
  if (!bodyBinary || !bodyBinary.byteLength) {
    window.log.info('download from fileserver failed with status, empty content downloaded ');
    return null;
  }

  return bodyBinary.buffer;
};

/**
 * Fetch the latest desktop release available on github from the fileserver.
 * This call is onion routed and so do not expose our ip to github nor the file server.
 */
export const getLatestReleaseFromFileServer = async (
  userEd25519SecretKey: Uint8Array,
  releaseType?: ReleaseChannels
): Promise<[string, ReleaseChannels] | null> => {
  const sigTimestampSeconds = NetworkTime.nowSeconds();
  const blindedPkHex = await BlindingActions.blindVersionPubkey({
    ed25519SecretKey: userEd25519SecretKey,
  });
  const method = 'GET';
  let releaseChannel = Storage.get('releaseChannel') as ReleaseChannels;

  if (!releaseChannel || !isReleaseChannel(releaseChannel)) {
    releaseChannel = 'stable';
    await Storage.put('releaseChannel', releaseChannel);
  }

  const queryParams = new URLSearchParams();
  queryParams.append('platform', 'desktop');
  queryParams.append('release_channel', releaseType || releaseChannel);
  const endpoint = `${RELEASE_VERSION_ENDPOINT}?${queryParams}`;

  const signature = await BlindingActions.blindVersionSignRequest({
    ed25519SecretKey: userEd25519SecretKey,
    sigTimestampSeconds,
    sigMethod: method,
    sigPath: endpoint,
    sigBody: null,
  });

  const headers = {
    'X-FS-Pubkey': blindedPkHex,
    'X-FS-Timestamp': `${sigTimestampSeconds}`,
    'X-FS-Signature': fromUInt8ArrayToBase64(signature),
  };

  const params = {
    abortSignal: new AbortController().signal,
    endpoint,
    method,
    stringifiedBody: null,
    headers,
    timeoutMs: 10 * DURATION.SECONDS,
    target: 'DEFAULT' as const,
  };
  const result = await OnionSending.sendJsonViaOnionV4ToFileServer(params);

  if (!batchGlobalIsSuccess(result) || OnionV4.parseStatusCodeFromV4Request(result) !== 200) {
    return null;
  }

  // we should probably change the logic of sendOnionRequestNoRetries to not have all those levels
  const latestVersionWithV = (result?.body as any)?.result;
  if (!latestVersionWithV) {
    return null;
  }
  return [latestVersionWithV, releaseType || releaseChannel];
};
