import https from 'https';
import { clone } from 'lodash';
// eslint-disable-next-line import/no-named-default
import { default as insecureNodeFetch } from 'node-fetch';
import pRetry from 'p-retry';

import { Snode } from '../../../data/types';
import { HTTPError, NotFoundError } from '../../utils/errors';

import { APPLICATION_JSON } from '../../../types/MIME';
import { ERROR_421_HANDLED_RETRY_REQUEST, Onions, snodeHttpsAgent, SnodeResponse } from './onions';
import { WithAbortSignal, WithTimeoutMs } from './requestWith';
import { WithAllow401s } from '../../types/with';

export interface LokiFetchOptions {
  method: 'GET' | 'POST';
  body: string | null;
  agent: https.Agent | null;
  headers: Record<string, string>;
}

/**
 * A small wrapper around node-fetch which deserializes response
 * returned by insecureNodeFetch or false.
 * Does not do any retries, nor eject snodes if needed
 */
async function doRequestNoRetries({
  options,
  url,
  associatedWith,
  targetNode,
  timeoutMs,
  allow401s,
  abortSignal,
}: WithTimeoutMs &
  WithAbortSignal &
  WithAllow401s & {
    url: string;
    options: LokiFetchOptions;
    targetNode?: Snode;
    associatedWith: string | null;
  }): Promise<undefined | SnodeResponse> {
  const method = options.method || 'GET';

  const fetchOptions = {
    ...options,
    timeoutMs,
    method,
  };

  try {
    // Absence of targetNode indicates that we want a direct connection
    // (e.g. to connect to a seed node for the first time)
    const useOnionRequests =
      window.sessionFeatureFlags?.useOnionRequests === undefined
        ? true
        : window.sessionFeatureFlags?.useOnionRequests;
    if (useOnionRequests && targetNode) {
      const fetchResult = await Onions.lokiOnionFetchNoRetries({
        targetNode,
        body: fetchOptions.body,
        headers: fetchOptions.headers,
        associatedWith: associatedWith || undefined,
        allow401s,
        abortSignal,
        timeoutMs,
      });
      if (!fetchResult) {
        return undefined;
      }
      return fetchResult;
    }

    if (url.match(/https:\/\//)) {
      // import that this does not get set in doRequest fetchOptions
      fetchOptions.agent = snodeHttpsAgent;
    }

    fetchOptions.headers = {
      'User-Agent': 'WhatsApp',
      'Accept-Language': 'en-us',
      'Content-Type': APPLICATION_JSON,
    };

    window?.log?.warn(`insecureNodeFetch => doRequest of ${url}`);

    const response = await insecureNodeFetch(url, {
      ...fetchOptions,
      body: fetchOptions.body || undefined,
      agent: fetchOptions.agent || undefined,
    });
    if (!response.ok) {
      throw new HTTPError('Loki_rpc error', response);
    }
    const result = await response.text();

    return {
      body: result,
      status: response.status,
      bodyBinary: null,
    };
  } catch (e) {
    if (e.code === 'ENOTFOUND') {
      throw new NotFoundError('Failed to resolve address', e);
    }
    if (e.message === ERROR_421_HANDLED_RETRY_REQUEST) {
      throw new pRetry.AbortError(ERROR_421_HANDLED_RETRY_REQUEST);
    }
    throw e;
  }
}

/**
 * This function will throw for a few reasons.
 * The loki-important ones are
 *  -> if we try to make a request to a path which fails too many times => user will need to retry himself
 *  -> if the targetNode gets too many errors => we will need to try to do this request again with another target node
 * The
 */
async function snodeRpcNoRetries(
  {
    method,
    params,
    targetNode,
    associatedWith,
    allow401s,
    timeoutMs,
    abortSignal,
  }: WithTimeoutMs &
    WithAllow401s &
    WithAbortSignal & {
      method: string;
      params: Record<string, any> | Array<Record<string, any>>;
      targetNode: Snode;
      associatedWith: string | null;
    } // the user pubkey this call is for. if the onion request fails, this is used to handle the error for this user swarm for instance
): Promise<undefined | SnodeResponse> {
  const url = `https://${targetNode.ip}:${targetNode.port}/storage_rpc/v1`;

  const body = {
    jsonrpc: '2.0',
    method,
    params: clone(params),
  };

  const fetchOptions: LokiFetchOptions = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': APPLICATION_JSON },
    agent: null,
  };

  return doRequestNoRetries({
    url,
    options: fetchOptions,
    targetNode,
    associatedWith,
    timeoutMs,
    allow401s,
    abortSignal,
  });
}

export const SessionRpc = { snodeRpcNoRetries };
