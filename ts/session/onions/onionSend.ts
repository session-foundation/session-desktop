import { AbortSignal } from 'abort-controller';
import { toNumber } from 'lodash';
import pRetry from 'p-retry';
import { crypto_sign_ed25519_pk_to_curve25519, from_hex, to_hex } from 'libsodium-wrappers-sumo';

import { OnionPaths } from '.';
import { Snode } from '../../data/types';
import { OpenGroupPollingUtils } from '../apis/open_group_api/opengroupV2/OpenGroupPollingUtils';
import { invalidAuthRequiresBlinding } from '../apis/open_group_api/opengroupV2/OpenGroupServerPoller';
import {
  addBinaryContentTypeToHeaders,
  addJsonContentTypeToHeaders,
} from '../apis/open_group_api/sogsv3/sogsV3SendMessage';
import {
  FinalDestNonSnodeOptions,
  FinalRelayOptions,
  Onions,
  STATUS_NO_STATUS,
  buildErrorMessageWithFailedCode,
} from '../apis/snode_api/onions';
import { PROTOCOLS } from '../constants';
import { OnionV4 } from './onionv4';
import { MergedAbortSignal, WithAbortSignal, WithTimeoutMs } from '../apis/snode_api/requestWith';
import { OnionPathEmptyError } from '../utils/errors';
import { SnodePool } from '../apis/snode_api/snodePool';
import { SERVER_HOSTS } from '../apis';
import type { FileFromFileServerDetails } from '../apis/file_server_api/types';
import { FS, type FILE_SERVER_TARGET_TYPE } from '../apis/file_server_api/FileServerTarget';

export type OnionFetchOptions = {
  method: string;
  body: string | Uint8Array | null;
  headers: Record<string, string | number>;
  useV4: boolean;
};

// NOTE some endpoints require decoded strings
const endpointExceptions = ['/reaction'];
const endpointRequiresDecoding = (url: string): string => {
  for (let i = 0; i < endpointExceptions.length; i++) {
    if (url.includes(endpointExceptions[i])) {
      return decodeURIComponent(url);
    }
  }
  return url;
};

const buildSendViaOnionPayload = (
  url: URL,
  fetchOptions: OnionFetchOptions
): FinalDestNonSnodeOptions => {
  const endpoint = OnionSending.endpointRequiresDecoding(
    url.search ? `${url.pathname}${url.search}` : url.pathname
  );

  const payloadObj: FinalDestNonSnodeOptions = {
    method: fetchOptions.method || 'GET',
    body: fetchOptions.body,
    endpoint,
    headers: fetchOptions.headers || {},
  };

  // the usev4 field is skipped here, as the snode doing the request won't care about it
  return payloadObj;
};

const getOnionPathForSending = async () => {
  let pathNodes: Array<Snode> = [];
  try {
    pathNodes = await OnionPaths.getOnionPath({});
  } catch (e) {
    window?.log?.error(`sendViaOnion - getOnionPath Error ${e.code} ${e.message}`);
  }
  if (!pathNodes?.length) {
    window?.log?.warn('sendViaOnion - failing, no path available');
    // should we retry?
    return null;
  }
  return pathNodes;
};

export type OnionV4SnodeResponse = {
  body: string | object | null; // if the content can be decoded as string
  bodyBinary: Uint8Array | null; // otherwise we return the raw content (could be an image data or file from sogs/fileserver)
  status_code: number;
};

export type OnionV4JSONSnodeResponse = {
  body: Record<string, any> | null;
  status_code: number;
};

export type OnionV4BinarySnodeResponse = {
  bodyBinary: Uint8Array | null;
  status_code: number;
};

/**
 * Build & send an onion v4 request to a non snode, and handle retries.
 * We actually can only send v4 request to non snode, as the snodes themselves do not support v4 request as destination.
 */

const sendViaOnionV4ToNonSnodeWithRetries = async (
  destinationX25519Key: string,
  url: URL,
  fetchOptions: OnionFetchOptions,
  throwErrors: boolean,
  abortSignal: MergedAbortSignal,
  timeoutMs: number
): Promise<OnionV4SnodeResponse | null> => {
  if (!fetchOptions.useV4) {
    throw new Error('sendViaOnionV4ToNonSnodeWithRetries is only to be used for onion v4 calls');
  }

  if (typeof destinationX25519Key !== 'string') {
    throw new Error(`destinationX25519Key is not a string ${typeof destinationX25519Key})a`);
  }

  const payloadObj = buildSendViaOnionPayload(url, fetchOptions);

  if (window.sessionFeatureFlags?.debugNonSnodeRequests) {
    window.log.info(
      '[debugNonSnodeRequests] sendViaOnionV4ToNonSnodeWithRetries: buildSendViaOnionPayload returned ',
      JSON.stringify(payloadObj)
    );
  }
  // if protocol is forced to 'http:' => just use http (without the ':').
  // otherwise use https as protocol (this is the default)
  const forcedHttp = url.protocol === PROTOCOLS.HTTP;
  const finalRelayOptions: FinalRelayOptions = {
    host: url.hostname,
  };

  if (forcedHttp) {
    finalRelayOptions.protocol = 'http';
  }
  if (forcedHttp) {
    finalRelayOptions.port = url.port ? toNumber(url.port) : 80;
  }

  let result: OnionV4SnodeResponse | null;
  try {
    result = await pRetry(
      async () => {
        const pathNodes = await OnionSending.getOnionPathForSending();
        if (window.sessionFeatureFlags?.debugNonSnodeRequests) {
          window.log.info(
            '[debugNonSnodeRequests] sendViaOnionV4ToNonSnodeWithRetries: getOnionPathForSending returned',
            JSON.stringify(pathNodes)
          );
        }
        if (!pathNodes) {
          throw new OnionPathEmptyError();
        }

        /**
         * This call handles ejecting a snode or a path if needed. If that happens, it throws a retryable error and the pRetry
         * call above will call us again with the same params but a different path.
         * If the error is not recoverable, it throws a pRetry.AbortError.
         */
        const onionV4Response = await Onions.sendOnionRequestHandlingSnodeEjectNoRetries({
          nodePath: pathNodes,
          destSnodeX25519: destinationX25519Key,
          finalDestOptions: payloadObj,
          finalRelayOptions,
          abortSignal,
          useV4: true,
          throwErrors,
          allow401s: false,
          timeoutMs,
        });

        if (window.sessionFeatureFlags?.debugNonSnodeRequests) {
          window.log.info(
            '[debugNonSnodeRequests] sendViaOnionV4ToNonSnodeWithRetries: sendOnionRequestHandlingSnodeEjectNoRetries returned: ',
            JSON.stringify(onionV4Response)
          );
        }

        if (abortSignal?.aborted) {
          // if the request was aborted, we just want to stop retries.
          window?.log?.warn('sendViaOnionV4ToNonSnodeWithRetries request aborted.');

          throw new pRetry.AbortError('Request Aborted');
        }

        if (!onionV4Response) {
          // v4 failed responses result is undefined
          window?.log?.warn('sendViaOnionV4ToNonSnodeWithRetries failed during V4 request (in)');
          throw new Error(
            'sendViaOnionV4ToNonSnodeWithRetries failed during V4 request. Retrying...'
          );
        }

        // This only decodes single entries for now.
        // We decode it here, because if the result status code is not valid, we want to trigger a retry (by throwing an error)
        const decodedV4 = OnionV4.decodeV4Response(onionV4Response);

        if (window.sessionFeatureFlags?.debugNonSnodeRequests) {
          window.log.info(
            `[debugNonSnodeRequests] sendViaOnionV4ToNonSnodeWithRetries: payload: ${JSON.stringify(payloadObj)}\ndecoded response:`,
            JSON.stringify(decodedV4)
          );
        }

        // the pn server replies with the decodedV4?.metadata as any)?.code syntax too since onion v4
        const foundStatusCode = decodedV4?.metadata?.code || STATUS_NO_STATUS;
        if (foundStatusCode < 200 || foundStatusCode > 299) {
          // this is temporary (as of 27/06/2022) as we want to not support unblinded sogs after some time

          if (foundStatusCode === 400) {
            const plainText = (decodedV4?.body as any).plainText;

            if (plainText === invalidAuthRequiresBlinding) {
              if (window.sessionFeatureFlags?.debugNonSnodeRequests) {
                window.log.info(
                  `[debugNonSnodeRequests] sendViaOnionV4ToNonSnodeWithRetries: payload: ${JSON.stringify(payloadObj)}\n${foundStatusCode} error with message:\nplainText: ${plainText}`
                );
              }

              return {
                status_code: foundStatusCode,
                body: decodedV4?.body || null,
                bodyBinary: decodedV4?.bodyBinary || null,
              };
            }
          }

          if (foundStatusCode === 404) {
            window.log.warn(
              `Got ${foundStatusCode} while sendViaOnionV4ToNonSnodeWithRetries with url:${url}. Stopping retries`
            );
            // most likely, a 404 won't fix itself. So just stop right here retries by throwing a non retryable error
            throw new pRetry.AbortError(
              buildErrorMessageWithFailedCode(
                'sendViaOnionV4ToNonSnodeWithRetries',
                404,
                `with url:${url}. Stopping retries`
              )
            );
          }

          // NOTE we want to return the error status code to the caller, so they can handle it
          if (url.host === SERVER_HOSTS.NETWORK_SERVER) {
            return {
              status_code: foundStatusCode,
              body: decodedV4?.body || null,
              bodyBinary: decodedV4?.bodyBinary || null,
            };
          }
          // we consider those cases as an error, and trigger a retry (if possible), by throwing a non-abortable error
          throw new Error(
            `sendViaOnionV4ToNonSnodeWithRetries failed with status code: ${foundStatusCode}. Retrying...`
          );
        }

        return {
          status_code: foundStatusCode,
          body: decodedV4?.body || null,
          bodyBinary: decodedV4?.bodyBinary || null,
        };
      },
      {
        retries: 2, // retry 3 (2+1) times at most
        minTimeout: OnionSending.getMinTimeoutForSogs(),
        onFailedAttempt: e => {
          window?.log?.warn(
            `sendViaOnionV4ToNonSnodeWithRetries attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...: ${e.message}`
          );
        },
      }
    );
  } catch (e) {
    window?.log?.warn('sendViaOnionV4ToNonSnodeWithRetries failed ', e.message, throwErrors);
    // NOTE if there are no snodes available, we want to refresh the snode pool from the seed
    if (e instanceof OnionPathEmptyError) {
      window?.log?.warn(
        'sendViaOnionV4ToNonSnodeWithRetries failed, no path available, refreshing snode pool'
      );
      void SnodePool.forceRefreshRandomSnodePool();
    }
    if (throwErrors) {
      throw e;
    }
    return null;
  }

  if (abortSignal?.aborted) {
    window?.log?.warn('sendViaOnionV4ToNonSnodeWithRetries request aborted.');

    return null;
  }

  if (!result) {
    // v4 failed responses result is undefined
    window?.log?.warn('sendViaOnionV4ToNonSnodeWithRetries failed during V4 request (out)');
    return null;
  }

  return result;
};

async function sendJsonViaOnionV4ToSogs(
  sendOptions: WithTimeoutMs & {
    serverUrl: string;
    endpoint: string;
    serverPubkey: string;
    blinded: boolean;
    method: string;
    stringifiedBody: string | null;
    abortSignal: AbortSignal;
    headers: Record<string, any> | null;
    throwErrors: boolean;
    /**
     * Auth headers are usually required, but can be skipped for some endpoints.
     * Set this to false to not include them.
     */
    includeAuthHeaders?: boolean;
  }
): Promise<OnionV4JSONSnodeResponse | null> {
  const {
    serverUrl,
    endpoint,
    serverPubkey,
    method,
    blinded,
    stringifiedBody,
    abortSignal,
    headers: includedHeaders,
    throwErrors,
    includeAuthHeaders = true,
    timeoutMs,
  } = sendOptions;

  if (!endpoint.startsWith('/')) {
    throw new Error('endpoint needs a leading /');
  }

  const builtUrl = new URL(`${serverUrl}${endpoint}`);
  let headersWithSogsHeadersIfNeeded: Record<string, any> = includedHeaders || {};

  if (includeAuthHeaders) {
    const ourHeaders = await OpenGroupPollingUtils.getOurOpenGroupHeaders(
      serverPubkey,
      endpoint,
      method,
      blinded,
      stringifiedBody
    );

    if (!ourHeaders) {
      return null;
    }

    headersWithSogsHeadersIfNeeded = {
      ...headersWithSogsHeadersIfNeeded,
      ...ourHeaders,
    };
  }

  const res = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    serverPubkey,
    builtUrl,
    {
      method,
      headers: addJsonContentTypeToHeaders(headersWithSogsHeadersIfNeeded as any),
      body: stringifiedBody,
      useV4: true,
    },
    throwErrors,
    abortSignal,
    timeoutMs
  );

  return res as OnionV4JSONSnodeResponse | null;
}

async function sendBinaryViaOnionV4ToSogs(
  sendOptions: WithTimeoutMs & {
    serverUrl: string;
    endpoint: string;
    serverPubkey: string;
    blinded: boolean;
    method: string;
    bodyBinary: Uint8Array;
    abortSignal: AbortSignal;
    headers: Record<string, any> | null;
  }
): Promise<OnionV4JSONSnodeResponse | null> {
  const {
    serverUrl,
    endpoint,
    serverPubkey,
    method,
    blinded,
    bodyBinary,
    abortSignal,
    headers: includedHeaders,
    timeoutMs,
  } = sendOptions;

  if (!bodyBinary) {
    return null;
  }
  if (!endpoint.startsWith('/')) {
    throw new Error('endpoint needs a leading /');
  }
  const builtUrl = new window.URL(`${serverUrl}${endpoint}`);
  let headersWithSogsHeadersIfNeeded = await OpenGroupPollingUtils.getOurOpenGroupHeaders(
    serverPubkey,
    endpoint,
    method,
    blinded,
    bodyBinary
  );

  if (!headersWithSogsHeadersIfNeeded) {
    return null;
  }
  headersWithSogsHeadersIfNeeded = { ...includedHeaders, ...headersWithSogsHeadersIfNeeded };
  const res = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    serverPubkey,
    builtUrl,
    {
      method,
      headers: addBinaryContentTypeToHeaders(headersWithSogsHeadersIfNeeded as any),
      body: bodyBinary || undefined,
      useV4: true,
    },
    false,
    abortSignal,
    timeoutMs
  );

  return res as OnionV4JSONSnodeResponse;
}

/**
 *
 * FILE SERVER REQUESTS
 *
 */

/**
 * Upload binary to the file server.
 * You should probably not use this function directly, but instead rely on the FileServerAPI.uploadFileToFsWithOnionV4()
 */
async function sendBinaryViaOnionV4ToFileServer({
  target,
  endpoint,
  method,
  bodyBinary,
  abortSignal,
  timeoutMs,
  headers = {},
}: WithTimeoutMs &
  WithAbortSignal & {
    target: FILE_SERVER_TARGET_TYPE;
    endpoint: string;
    method: string;
    bodyBinary: Uint8Array;
    headers?: Record<string, string | number>;
  }): Promise<OnionV4JSONSnodeResponse | null> {
  const res = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    FS.FILE_SERVERS[target].xPk,
    new URL(`${FS.FILE_SERVERS[target].url}${endpoint}`),
    {
      method,
      headers,
      body: bodyBinary,
      useV4: true,
    },
    false,
    abortSignal,
    timeoutMs
  );

  return res as OnionV4JSONSnodeResponse;
}

/**
 * Download binary from the file server.
 * You should probably not use this function directly, but instead rely on the FileServerAPI.downloadFileFromFileServer()
 */
async function getBinaryViaOnionV4FromFileServer({
  fileToGet,
  abortSignal,
  throwError,
  timeoutMs,
}: WithTimeoutMs &
  WithAbortSignal & {
    fileToGet: FileFromFileServerDetails;
    throwError: boolean;
  }): Promise<OnionV4BinarySnodeResponse | null> {
  if (window.sessionFeatureFlags?.debugServerRequests) {
    window.log.info(`getBinaryViaOnionV4FromFileServer fsv2: "${fileToGet.fullUrl} `);
  }

  if (!fileToGet.fullUrl) {
    throw new Error('getBinaryViaOnionV4FromFileServer: fullUrl is required');
  }

  const serverX25519Pk = to_hex(
    crypto_sign_ed25519_pk_to_curve25519(from_hex(fileToGet.serverEd25519Pk))
  );

  // this throws for a bunch of reasons.
  // One of them, is if we get a 404 (i.e. the file server was reached but reported no such attachments exists)
  const res = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    serverX25519Pk,
    fileToGet.fullUrl,
    {
      method: 'GET',
      headers: {},
      body: null,
      useV4: true,
    },
    throwError,
    abortSignal,
    timeoutMs
  );

  if (window.sessionFeatureFlags?.debugServerRequests) {
    window.log.debug(
      `getBinaryViaOnionV4FromFileServer fsv2: "${fileToGet.fullUrl}; got:`,
      JSON.stringify(res)
    );
  }
  return res as OnionV4BinarySnodeResponse;
}

/**
 * Send some generic json to the fileserver.
 * This function should probably not used directly as we only need it for the FileServerApi.getLatestReleaseFromFileServer() function
 */
async function sendJsonViaOnionV4ToFileServer({
  endpoint,
  target,
  method,
  stringifiedBody,
  abortSignal,
  headers,
  timeoutMs,
}: WithAbortSignal &
  WithTimeoutMs & {
    target: FILE_SERVER_TARGET_TYPE;
    endpoint: string;
    method: string;
    stringifiedBody: string | null;
    headers: Record<string, string | number>;
  }): Promise<OnionV4JSONSnodeResponse | null> {
  if (!endpoint.startsWith('/')) {
    throw new Error('endpoint needs a leading /');
  }
  const builtUrl = new URL(`${FS.FILE_SERVERS[target].url}${endpoint}`);

  const res = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    FS.FILE_SERVERS[target].xPk,
    builtUrl,
    {
      method,
      headers,
      body: stringifiedBody,
      useV4: true,
    },
    false,
    abortSignal,
    timeoutMs
  );

  return res as OnionV4JSONSnodeResponse;
}

/**
 * Send some generic json to the sent server.
 * This function should probably not used directly as we only need it for the NetworkApi.makeRequest() function
 */
async function sendJsonViaOnionV4ToSeshServer({
  serverUrl,
  endpoint,
  method,
  headers,
  stringifiedBody,
  pubkey,
  abortSignal,
  timeoutMs,
}: WithAbortSignal &
  WithTimeoutMs & {
    serverUrl: string;
    endpoint: string;
    method: string;
    headers: Record<string, string | number>;
    stringifiedBody: string | null;
    pubkey: string;
  }): Promise<OnionV4JSONSnodeResponse | null> {
  if (!endpoint.startsWith('/')) {
    throw new Error('endpoint needs a leading /');
  }

  if (serverUrl.endsWith('/')) {
    throw new Error('url should not end with /');
  }

  const builtUrl = new URL(`${serverUrl}${endpoint}`);

  const res = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    pubkey,
    builtUrl,
    {
      method,
      headers,
      body: stringifiedBody,
      useV4: true,
    },
    false,
    abortSignal,
    timeoutMs
  );

  return res as OnionV4JSONSnodeResponse;
}

/**
 * This is used during stubbing so we can override the time between retries (so the unit tests are faster)
 */
function getMinTimeoutForSogs() {
  return 100;
}

// we export these methods for stubbing during testing
export const OnionSending = {
  endpointRequiresDecoding,
  sendViaOnionV4ToNonSnodeWithRetries,
  getOnionPathForSending,
  sendJsonViaOnionV4ToSogs,
  sendBinaryViaOnionV4ToFileServer,
  sendBinaryViaOnionV4ToSogs,
  getBinaryViaOnionV4FromFileServer,
  sendJsonViaOnionV4ToSeshServer,
  sendJsonViaOnionV4ToFileServer,
  getMinTimeoutForSogs,
};
