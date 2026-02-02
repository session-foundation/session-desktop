import AbortController from 'abort-controller';
import { isEmpty, isFinite, isNumber, isString, omit, toNumber } from 'lodash';

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
import { FileFromFileServerDetails } from './types';
import { queryParamDeterministicEncryption, queryParamServerEd25519Pubkey } from '../../url';
import { FS, type FILE_SERVER_TARGET_TYPE } from './FileServerTarget';
import { getFeatureFlag } from '../../../state/ducks/types/releasedFeaturesReduxTypes';
import { stringify } from '../../../types/sqlSharedTypes';

const RELEASE_VERSION_ENDPOINT = '/session_version';
const FILE_ENDPOINT = '/file';
const ALPHANUMERIC_ID_LEN = 44;

function getShortTTLHeadersIfNeeded(): Record<string, string> {
  if (getFeatureFlag('fsTTL30s')) {
    return { 'X-FS-TTL': '30' };
  }
  return {};
}

/**
 * Upload a file to the file server v2 using the onion v4 encoding
 * @param fileContent the data to send
 * @param deterministicEncryption whether the file is deterministically encrypted or not
 * @returns null or the complete URL to share this file
 */
export const uploadFileToFsWithOnionV4 = async (
  fileContent: ArrayBuffer,
  deterministicEncryption: boolean
): Promise<{ fileUrl: string; expiresMs: number } | null> => {
  if (!fileContent || !fileContent.byteLength) {
    return null;
  }

  const target = process.env.POTATO_FS
    ? 'POTATO'
    : process.env.SUPER_DUPER_FS
      ? 'SUPER_DUPER'
      : 'DEFAULT';

  const result = await OnionSending.sendBinaryViaOnionV4ToFileServer({
    abortSignal: new AbortController().signal,
    bodyBinary: new Uint8Array(fileContent),
    target,
    endpoint: FILE_ENDPOINT,
    method: 'POST',
    timeoutMs: 30 * DURATION.SECONDS, // longer time for file upload
    headers: getShortTTLHeadersIfNeeded(),
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

  // we now have the `fileUrl` provide the `serverPubkey` and the deterministic flag as an url fragment.
  const urlParams = new URLSearchParams();
  // Note: we don't want to set the pk for the default FS (it breaks prod builds on mobile)
  if (target !== 'DEFAULT') {
    urlParams.set(queryParamServerEd25519Pubkey, FS.FILE_SERVERS[target].edPk);
  }
  if (deterministicEncryption) {
    urlParams.set(queryParamDeterministicEncryption, '');
  }
  const urlParamStr = urlParams.toString();
  const fileUrl = `${FS.FILE_SERVERS[target].url}${FILE_ENDPOINT}/${fileId}${urlParamStr ? `#${urlParamStr}` : ''}`;
  const expiresMs = Math.floor(expires * 1000);
  return {
    fileUrl,
    expiresMs,
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
  if (getFeatureFlag('debugServerRequests')) {
    window.log.info(`about to try to download fsv2: "${toDownload.fullUrl}"`);
  }

  // this throws if we get a 404 from the file server
  const result = await OnionSending.getBinaryViaOnionV4FromFileServer({
    abortSignal: new AbortController().signal,
    fileToGet: toDownload,
    throwError: true,
    timeoutMs: 30 * DURATION.SECONDS, // longer time for file download
  });
  if (getFeatureFlag('debugServerRequests')) {
    window.log.info(
      `download fsv2: "${toDownload.fullUrl} got result:`,
      stringify(omit(result, 'bodyBinary'))
    );
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

/**
 * Extend a file expiry from the file server.
 * This only works with files that have an alphanumeric id (of length 44).
 *
 */
export const extendFileExpiry = async (fileId: string, fsTarget: FILE_SERVER_TARGET_TYPE) => {
  if (fileId.length !== ALPHANUMERIC_ID_LEN) {
    window.log.debug(
      `Cannot renew expiry of non deterministic fileId with length: "${fileId.length}"`
    );

    return null;
  }
  if (getFeatureFlag('debugServerRequests')) {
    window.log.info(`about to renew expiry of file: "${fileId}"`);
  }

  const method = 'POST';
  const endpoint = `/file/${fileId}/extend`;

  const result = await OnionSending.sendJsonViaOnionV4ToFileServer({
    abortSignal: new AbortController().signal,
    endpoint,
    method,
    stringifiedBody: null,
    headers: getShortTTLHeadersIfNeeded(),
    timeoutMs: 10 * DURATION.SECONDS,
    target: fsTarget,
  });

  if (!batchGlobalIsSuccess(result)) {
    return null;
  }

  const {
    expires: fileNewExpirySeconds,
    uploaded: fileUploadedSeconds,
    size,
  } = result?.body as any;
  if (!fileNewExpirySeconds) {
    return null;
  }
  return {
    fileNewExpiryMs: Math.floor(fileNewExpirySeconds * 1000), // the expires/uploaded have the ms in the decimals (i.e `1761002358.02229`)
    fileUploadedMs: Math.floor(fileUploadedSeconds * 1000),
    size: toNumber(size),
  };
};
