import { PRO_API } from './ProBackendTarget';
import SessionBackendServerApi from '../session_backend_server';
import {
  GetProProofResponseSchema,
  GetProProofResponseType,
  GetProRevocationsResponseSchema,
  GetProRevocationsResponseType,
  GetProStatusResponseSchema,
  GetProStatusResponseType,
} from './types';
import { ProWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { NetworkTime } from '../../../util/NetworkTime';

export default class ProBackendAPI {
  static readonly server = new SessionBackendServerApi(
    PRO_API.PRO_BACKENDS[process.env.PRO_DEV ? 'DEV' : 'DEFAULT']
  );
  static readonly requestVersion = 0;

  static getProSigningArgs() {
    // TODO: get real pro master private key
    const masterPrivKeyHex = '';
    return {
      requestVersion: ProBackendAPI.requestVersion,
      masterPrivKeyHex,
      unixTsMs: NetworkTime.now(),
    };
  }

  private static async getProProofBody() {
    // TODO: get real rotating private key
    const rotatingPrivKeyHex = '';
    return ProWrapperActions.proProofRequestBody({
      ...ProBackendAPI.getProSigningArgs(),
      rotatingPrivKeyHex,
    });
  }

  static async getProProof(): Promise<GetProProofResponseType | null> {
    return ProBackendAPI.server.makeRequestWithSchema({
      path: '/get_pro_proof',
      method: 'POST',
      bodyGetter: ProBackendAPI.getProProofBody,
      withZodSchema: GetProProofResponseSchema,
    });
  }

  private static async getProStatusBody() {
    return ProWrapperActions.proStatusRequestBody({
      ...ProBackendAPI.getProSigningArgs(),
      withPaymentHistory: false,
    });
  }

  static async getProStatus(): Promise<GetProStatusResponseType | null> {
    return ProBackendAPI.server.makeRequestWithSchema({
      path: '/get_pro_status',
      method: 'POST',
      bodyGetter: ProBackendAPI.getProStatusBody,
      withZodSchema: GetProStatusResponseSchema,
    });
  }

  static async getRevocationList(): Promise<GetProRevocationsResponseType | null> {
    const bodyGetter = async () => '{ "version": 0, "ticket": 0 }';

    return ProBackendAPI.server.makeRequestWithSchema({
      path: '/get_pro_revocations',
      method: 'POST',
      bodyGetter,
      withZodSchema: GetProRevocationsResponseSchema,
    });
  }
}
