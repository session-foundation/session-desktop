import type {
  WithMasterPrivKeyHex,
  WithRotatingPrivKeyHex,
  WithTicket,
} from 'libsession_util_nodejs';

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

  static getProSigningArgs({ masterPrivKeyHex }: WithMasterPrivKeyHex) {
    return {
      requestVersion: ProBackendAPI.requestVersion,
      masterPrivKeyHex,
      unixTsMs: NetworkTime.now(),
    };
  }

  private static async getProProofBody({
    masterPrivKeyHex,
    rotatingPrivKeyHex,
  }: WithMasterPrivKeyHex & WithRotatingPrivKeyHex) {
    return ProWrapperActions.proProofRequestBody({
      ...ProBackendAPI.getProSigningArgs({ masterPrivKeyHex }),
      rotatingPrivKeyHex,
    });
  }

  static async getProProof(
    args: WithMasterPrivKeyHex & WithRotatingPrivKeyHex
  ): Promise<GetProProofResponseType | null> {
    return ProBackendAPI.server.makeRequestWithSchema({
      path: '/get_pro_proof',
      method: 'POST',
      bodyGetter: () => ProBackendAPI.getProProofBody(args),
      withZodSchema: GetProProofResponseSchema,
    });
  }

  private static async getProStatusBody(args: WithMasterPrivKeyHex) {
    return ProWrapperActions.proStatusRequestBody({
      ...ProBackendAPI.getProSigningArgs(args),
      withPaymentHistory: false,
    });
  }

  private static async getRevocationListBody(args: WithTicket) {
    return ProWrapperActions.proRevocationsRequestBody({ requestVersion: 0, ...args });
  }

  static async getProStatus(args: WithMasterPrivKeyHex): Promise<GetProStatusResponseType | null> {
    return ProBackendAPI.server.makeRequestWithSchema({
      path: '/get_pro_status',
      method: 'POST',
      bodyGetter: () => ProBackendAPI.getProStatusBody(args),
      withZodSchema: GetProStatusResponseSchema,
    });
  }

  static async getRevocationList(args: WithTicket): Promise<GetProRevocationsResponseType | null> {
    return ProBackendAPI.server.makeRequestWithSchema({
      path: '/get_pro_revocations',
      method: 'POST',
      bodyGetter: () => ProBackendAPI.getRevocationListBody(args),
      withZodSchema: GetProRevocationsResponseSchema,
    });
  }
}
