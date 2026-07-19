import type {
  WithMasterPrivKeyHex,
  WithRotatingPrivKeyHex,
  WithTicket,
} from 'libsession_util_nodejs';

import { PRO_API } from './ProBackendTarget';
import SessionBackendServerApi from '../session_backend_server';
import type {
  GenerateProProofResponseType,
  GetProDetailsResponseType,
  GetProRevocationsResponseType,
} from './schemas';
import { ProWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { NetworkTime } from '../../../util/NetworkTime';
import { getFeatureFlag } from '../../../state/ducks/types/releasedFeaturesReduxTypes';

export default class ProBackendAPI {
  private static readonly server = new SessionBackendServerApi(PRO_API.PRO_BACKENDS.DEFAULT);
  private static readonly testServer = new SessionBackendServerApi(PRO_API.PRO_BACKENDS.DEV);

  static getServer() {
    return getFeatureFlag('useTestProBackend') ? ProBackendAPI.testServer : ProBackendAPI.server;
  }

  /**
   * POST a libsession-built request (`{ endpoint, body }`) and relay the RAW response bytes to
   * libsession's parser — desktop never parses or interprets the wire itself (that's a
   * libsession<->backend contract). Returns null on transport failure or a missing body; app-level
   * (backend) errors surface via the parsed struct's `errors` (and non-success `status`).
   */
  private static async sendAndParse<T>(
    request: { endpoint: string; body: string },
    parse: (body: Uint8Array) => Promise<T>
  ): Promise<T | null> {
    const { status_code, bodyBinary } = await ProBackendAPI.getServer().makeRequestReturningRawBody({
      path: `/${request.endpoint}`,
      method: 'POST',
      bodyGetter: async () => request.body,
    });

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

  static async getProDetails(args: WithMasterPrivKeyHex): Promise<GetProDetailsResponseType | null> {
    const request = await ProWrapperActions.proStatusRequest({
      ...args,
      unixTsMs: NetworkTime.now(),
      // NOTE: the latest payment is the only one required for state derivation
      count: 1,
    });
    return ProBackendAPI.sendAndParse(request, body =>
      ProWrapperActions.parsePaymentDetailsResponse({ body })
    );
  }

  static async getRevocationList(args: WithTicket): Promise<GetProRevocationsResponseType | null> {
    const request = await ProWrapperActions.proRevocationsRequest(args);
    return ProBackendAPI.sendAndParse(request, body =>
      ProWrapperActions.parseRevocationsResponse({ body })
    );
  }
}
