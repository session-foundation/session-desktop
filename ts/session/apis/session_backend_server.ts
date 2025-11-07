import AbortController from 'abort-controller';
import { z, ZodError, ZodSchema } from 'zod';
import { BlindingActions } from '../../webworker/workers/browser/libsession_worker_interface';
import { isOnionV4JSONSnodeResponse, OnionSending } from '../onions/onionSend';
import { fromUInt8ArrayToBase64 } from '../utils/String';
import { NetworkTime } from '../../util/NetworkTime';
import {
  batchGlobalIsSuccess,
  parseBatchGlobalStatusCode,
} from './open_group_api/sogsv3/sogsV3BatchPoll';
import { UserUtils } from '../utils';
import { timeoutWithAbort } from '../utils/Promise';
import { DURATION } from '../constants';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';

export type SessionServerConfigType = {
  name: string;
  url: `${'http' | 'https'}://${string}`;
  edPkHex: string;
  xPkHex: string;
  requestTimeoutMs: number;
  abortControllerTimeoutMs: number;
};

export type SessionBackendServerApiOptions = Omit<
  SessionServerConfigType,
  'requestTimeoutMs' | 'abortControllerTimeoutMs'
> & {
  requestTimeoutMs?: number;
  abortControllerTimeoutMs?: number;
};

type WithZodSchemaValidation<S = ZodSchema> = {
  withZodSchema: S;
};

type HTTPMethod = 'GET' | 'POST';

type SessionBackendServerMakeRequestParams = {
  path: `/${string}`;
  method: HTTPMethod;
  bodyGetter?: () => Promise<string | null>;
  blindSignRequest?: boolean;
};

type BlindSignedHeaders = {
  'X-FS-Pubkey': string;
  'X-FS-Timestamp': string;
  'X-FS-Signature': string;
};

export const SessionBackendBaseResponseSchema = z.object({
  status_code: z.number(),
  t: z.number(),
});

export type SessionBackendBaseResponseSchema = z.infer<typeof SessionBackendBaseResponseSchema>;

export type SessionBackendServerApiResponse = SessionBackendBaseResponseSchema &
  Record<string, unknown>;

export default class SessionBackendServerApi {
  readonly server: SessionServerConfigType;

  constructor(
    server: SessionBackendServerApiOptions,
    requestTimeoutMsOverride?: number,
    abortControllerTimeoutMs?: number
  ) {
    this.server = {
      ...server,
      requestTimeoutMs:
        server.requestTimeoutMs || requestTimeoutMsOverride || 10 * DURATION.SECONDS,
      abortControllerTimeoutMs:
        server.abortControllerTimeoutMs || abortControllerTimeoutMs || 30 * DURATION.SECONDS,
    };
  }

  private static getGenericErrorResponse() {
    return {
      status_code: 500,
      t: NetworkTime.nowSeconds(),
    };
  }

  public logInfo(msg: string, path?: string) {
    window?.log?.info(`[${this.server.name}] ${path?.length ? `${path}: ` : ''}${msg}`);
  }
  public logError(msg: string, path?: string) {
    window?.log?.error(`[${this.server.name}] ${path?.length ? `${path}: ` : ''}${msg}`);
  }
  public logZodError(zodError: ZodError, path?: string) {
    window?.log?.error(`[${this.server.name}] ${path?.length ? `${path}: ` : ''}`, zodError);
  }

  // NOTE: returns null if the ed25519 key pair is not found
  private async getBlindSignedHeaders({
    method,
    path,
    body,
  }: {
    method: HTTPMethod;
    path: string;
    body: string | null;
  }): Promise<BlindSignedHeaders | null> {
    const ed25519SecretKey = (await UserUtils.getUserED25519KeyPairBytes()).privKeyBytes;
    if (!ed25519SecretKey) {
      this.logError(`${path} error: ed25519Secret key was not found when creating headers!`);
      return null;
    }

    const blindedPkHex = await BlindingActions.blindVersionPubkey({
      ed25519SecretKey,
    });

    const sigTimestampSeconds = NetworkTime.nowSeconds();
    const signedData = await BlindingActions.blindVersionSignRequest({
      ed25519SecretKey,
      sigTimestampSeconds,
      sigMethod: method,
      sigPath: path,
      sigBody: body ? new TextEncoder().encode(body) : null,
    });

    return {
      'X-FS-Pubkey': blindedPkHex,
      'X-FS-Timestamp': sigTimestampSeconds.toString(),
      'X-FS-Signature': fromUInt8ArrayToBase64(signedData),
    };
  }

  private async _makeRequest({
    path,
    method,
    bodyGetter,
    blindSignRequest,
  }: SessionBackendServerMakeRequestParams): Promise<SessionBackendServerApiResponse> {
    const body = typeof bodyGetter === 'function' ? await bodyGetter() : null;

    const headers = blindSignRequest
      ? await this.getBlindSignedHeaders({
          method,
          path,
          body,
        })
      : {};

    if (headers === null) {
      this.logError('failed to blind sign request parameters', path);
      return SessionBackendServerApi.getGenericErrorResponse();
    }

    const url = new URL(path, this.server.url);

    const controller = new AbortController();
    const result = await timeoutWithAbort(
      OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
        this.server.xPkHex,
        url,
        {
          method,
          headers,
          body,
          useV4: true,
        },
        false,
        controller.signal,
        this.server.requestTimeoutMs
      ),
      this.server.abortControllerTimeoutMs,
      controller
    );

    if (!result || !isOnionV4JSONSnodeResponse(result) || typeof result.body !== 'object') {
      this.logError(`returned a non json response ${JSON.stringify(result)}`, path);
      return SessionBackendServerApi.getGenericErrorResponse();
    }

    if (!batchGlobalIsSuccess(result)) {
      if (getFeatureFlag('debugServerRequests')) {
        this.logError(`failed with status ${parseBatchGlobalStatusCode(result)}`, path);
      }

      return SessionBackendServerApi.getGenericErrorResponse();
    }

    return {
      ...result.body,
      status_code: result.status_code,
      t:
        't' in result.body && typeof result.body.t === 'number'
          ? result.body.t
          : NetworkTime.nowSeconds(),
    };
  }

  private parseSchema<R extends ZodSchema>({
    path,
    response,
    schema,
  }: {
    path: string;
    response: SessionBackendServerApiResponse;
    schema: R;
  }): Exclude<ReturnType<R['safeParse']>['data'], undefined> | null {
    const result = schema.safeParse(response);
    if (result.success) {
      return result.data;
    }

    if (result.error) {
      this.logZodError(result.error, path);
    } else {
      this.logError('Failed to parse response', path);
    }

    return null;
  }

  public async makeRequest(
    params: SessionBackendServerMakeRequestParams
  ): Promise<SessionBackendServerApiResponse> {
    if (getFeatureFlag('debugServerRequests')) {
      this.logInfo(`\nrequest: ${JSON.stringify({ url: this.server.url, params })}`, params.path);
    }

    const response = await this._makeRequest(params);

    if (getFeatureFlag('debugServerRequests')) {
      this.logInfo(`\nresponse: ${JSON.stringify(response)}`, params.path);
    }

    return response;
  }

  public async makeRequestWithSchema<R extends ZodSchema>({
    withZodSchema,
    ...requestParams
  }: SessionBackendServerMakeRequestParams & WithZodSchemaValidation<R>): Promise<Exclude<
    ReturnType<R['safeParse']>['data'],
    undefined
  > | null> {
    const response = await this.makeRequest(requestParams);
    return this.parseSchema({ path: requestParams.path, response, schema: withZodSchema });
  }
}
