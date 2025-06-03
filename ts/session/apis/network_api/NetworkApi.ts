import { isEmpty } from 'lodash';
import AbortController from 'abort-controller';
import { BlindingActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { OnionSending, type OnionV4JSONSnodeResponse } from '../../onions/onionSend';
import { fromUInt8ArrayToBase64 } from '../../utils/String';
import { NetworkTime } from '../../../util/NetworkTime';
import {
  batchGlobalIsSuccess,
  parseBatchGlobalStatusCode,
} from '../open_group_api/sogsv3/sogsV3BatchPoll';
import { type InfoResponse, type NetworkAPIResponse, type ValidateHeaderResponse } from './types';
import { UserUtils } from '../../utils';
import { SERVER_HOSTS } from '..';
import { DURATION } from '../../constants';
import { timeoutWithAbort } from '../../utils/Promise';

const networkApiPubkey = 'cbf461a4431dc9174dceef4421680d743a2a0e1a3131fc794240bcb0bc3dd449';

export default class NetworkApi {
  readonly host: string = SERVER_HOSTS.NETWORK_SERVER;
  readonly pubkey: string = networkApiPubkey;

  getURL() {
    return `http://${this.host}`;
  }

  private async getHeaders(request: { method: string; path: string; body?: string }): Promise<
    | {
        'X-FS-Pubkey': string;
        'X-FS-Timestamp': string;
        'X-FS-Signature': string;
      }
    | Record<string, never>
  > {
    const userEd25519SecretKey = (await UserUtils.getUserED25519KeyPairBytes())?.privKeyBytes;

    if (!userEd25519SecretKey || isEmpty(userEd25519SecretKey)) {
      window.log.error(
        `[network api] ${request.path} error: userEd25519Secret key was not found when creating headers!`
      );
      return {};
    }

    const timestamp = NetworkTime.getNowWithNetworkOffsetSeconds();
    const blindedPkHex = await BlindingActions.blindVersionPubkey({
      ed25519SecretKey: userEd25519SecretKey,
    });

    const signedData = await BlindingActions.blindVersionSignRequest({
      ed25519SecretKey: userEd25519SecretKey,
      sigTimestampSeconds: timestamp,
      sigMethod: request.method,
      sigPath: request.path,
      sigBody: request.body ? new TextEncoder().encode(request.body) : null,
    });

    return {
      'X-FS-Pubkey': blindedPkHex,
      'X-FS-Timestamp': timestamp.toString(),
      'X-FS-Signature': fromUInt8ArrayToBase64(signedData),
    };
  }

  private async getRequestParams({
    endpoint,
    method,
    body,
    mock,
    timeoutMs = 10 * DURATION.SECONDS,
  }: {
    endpoint: '/info' | '/validate/headers';
    method: 'GET' | 'POST';
    body?: string;
    mock?: object;
    timeoutMs?: number;
  }) {
    const mockParams = new URLSearchParams();
    if (mock) {
      mockParams.append('mock', 'true');
      Object.entries(mock).forEach(([key, value]) => {
        mockParams.append(key, String(value));
      });
    }

    const path = mockParams.size ? `${endpoint}?${mockParams}` : endpoint;
    const headers = await this.getHeaders({
      method,
      path,
      body,
    });

    const requestParams = {
      serverUrl: this.getURL(),
      endpoint: path,
      method,
      headers,
      stringifiedBody: body || null,
      pubkey: this.pubkey,
      timeoutMs,
    };

    return requestParams;
  }

  private async makeRequest(request: Awaited<ReturnType<typeof this.getRequestParams>>) {
    if (window.sessionFeatureFlags?.debug.debugServerRequests) {
      window.log.info(`[network api] ${request.endpoint}\nrequest:`, JSON.stringify(request));
    }
    const controller = new AbortController();
    const result = await timeoutWithAbort(
      OnionSending.sendJsonViaOnionV4ToSeshServer({ ...request, abortSignal: controller.signal }),
      request.timeoutMs,
      controller
    );

    const response = this.handleOnionResponse(result, request.endpoint);

    if (window.sessionFeatureFlags?.debug.debugServerRequests) {
      window.log.info(`[network api] ${request.endpoint}\nresponse:`, JSON.stringify(response));
    }

    return response;
  }

  // #region Response handling

  private handleOnionResponse(
    result: OnionV4JSONSnodeResponse | null,
    endpoint: string
  ): NetworkAPIResponse | ValidateHeaderResponse | InfoResponse {
    const response: NetworkAPIResponse = {
      status_code: result?.status_code || 500,
      t: result?.body?.t || Date.now() / 1000,
    };

    if (!batchGlobalIsSuccess(result) || !result?.body) {
      if (window.sessionFeatureFlags?.debug.debugServerRequests) {
        window.log.error(
          `[network api] ${endpoint}: failed with status ${parseBatchGlobalStatusCode(result)} ${JSON.stringify(result)} `
        );
      }

      if (endpoint.startsWith('/validate/headers')) {
        return { ...response, success: false } as ValidateHeaderResponse;
      }

      return response;
    }

    return { ...response, ...result.body };
  }
  // #endregion

  // #region API calls

  async getValidateHeaders(): Promise<ValidateHeaderResponse> {
    if (window.sessionFeatureFlags?.debug.debugServerRequests) {
      window.log.info('[network api] /validate/headers: about to try to validate headers');
    }

    const params = await this.getRequestParams({
      endpoint: '/validate/headers',
      method: 'GET',
    });

    const result = await this.makeRequest(params);
    return result as ValidateHeaderResponse;
  }

  async getInfo(): Promise<InfoResponse | null> {
    if (window.sessionFeatureFlags?.debug.debugServerRequests) {
      window.log.info(`[network api] /info: about to try to get info`);
    }

    const params = await this.getRequestParams({
      endpoint: '/info',
      method: 'GET',
    });

    const result = (await this.makeRequest(params)) as InfoResponse;
    return result;
  }

  // #endregion
}
