import type {
  WithMasterPrivKeyHex,
  WithRotatingPrivKeyHex,
  WithTicket,
} from 'libsession_util_nodejs';

import { PRO_API } from './ProBackendTarget';
import SessionBackendServerApi from '../session_backend_server';
import type {
  GenerateProProofResponseType,
  GetProRevocationsResponseType,
  ProStatusResultType,
} from './schemas';
import { ProWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { NetworkTime } from '../../../util/NetworkTime';
import { getFeatureFlag } from '../../../state/ducks/types/releasedFeaturesReduxTypes';

export default class ProBackendAPI {
  private static readonly server = new SessionBackendServerApi(PRO_API.PRO_BACKENDS.DEFAULT);

  /**
   * Built on first use rather than alongside `server`: the DEV target is only populated when the
   * environment supplies one, so constructing it eagerly would mean building a server around an
   * unresolvable host on every normal run.
   */
  private static devServer: SessionBackendServerApi | undefined;

  static getServer() {
    if (getFeatureFlag('useTestProBackend')) {
      if (!PRO_API.isDevProBackendConfigured()) {
        // Fail loudly rather than silently falling back to the default backend: a test that asked for
        // the dev backend and quietly got production would either fail confusingly or, worse, pass.
        throw new Error(
          'useTestProBackend is enabled but no dev Pro backend is configured. Set ' +
            'TEST_PRO_BACKEND_URL, TEST_PRO_BACKEND_ED_PK and TEST_PRO_BACKEND_X_PK (the URL plus the ' +
            "Ed25519 and X25519 pubkeys from the backend's startup banner), or unset " +
            'TEST_PRO_BACKEND to use the default backend.'
        );
      }
      if (!ProBackendAPI.devServer) {
        ProBackendAPI.devServer = new SessionBackendServerApi(PRO_API.PRO_BACKENDS.DEV);
      }
      return ProBackendAPI.devServer;
    }
    return ProBackendAPI.server;
  }

  /**
   * POST a libsession-built request (`{ endpoint, body }`) and relay the RAW response bytes to
   * libsession's parser — desktop never parses or interprets the wire itself (that's a
   * libsession<->backend contract). Returns null on transport failure or a missing body; app-level
   * (backend) errors surface via the parsed struct's `errors` (and non-success `status`).
   */
  private static async sendAndParse<T>(
    request: { endpoint: string; contentType: string; body: string },
    parse: (body: Uint8Array) => Promise<T>
  ): Promise<T | null> {
    const { status_code, bodyBinary } = await ProBackendAPI.getServer().makeRequestReturningRawBody(
      {
        path: `/${request.endpoint}`,
        method: 'POST',
        contentType: request.contentType,
        bodyGetter: async () => request.body,
      }
    );

    if (status_code !== 200 || !bodyBinary) {
      return null;
    }

    return parse(bodyBinary);
  }

  static async generateProProof(
    args: WithMasterPrivKeyHex & WithRotatingPrivKeyHex
  ): Promise<GenerateProProofResponseType | null> {
    const request = await ProWrapperActions.proProofRequest({
      ...args,
      unixTsMs: NetworkTime.now(),
    });
    return ProBackendAPI.sendAndParse(request, body =>
      ProWrapperActions.parseProProofResponse({ body })
    );
  }

  static async getProStatus(args: WithMasterPrivKeyHex): Promise<ProStatusResultType | null> {
    const request = await ProWrapperActions.proStatusRequest({
      ...args,
      unixTsMs: NetworkTime.now(),
    });
    return ProBackendAPI.sendAndParse(request, body =>
      ProWrapperActions.parseProStatusResponse({ body })
    );
  }

  static async getRevocationList(args: WithTicket): Promise<GetProRevocationsResponseType | null> {
    const request = await ProWrapperActions.proRevocationsRequest(args);
    return ProBackendAPI.sendAndParse(request, body =>
      ProWrapperActions.parseRevocationsResponse({ body })
    );
  }
}
