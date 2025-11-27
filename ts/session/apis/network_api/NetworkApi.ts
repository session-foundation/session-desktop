import {
  InfoSchema,
  ValidateHeaderSchema,
  type InfoResponse,
  type ValidateHeaderResponse,
} from './types';
import { SERVER_HOSTS } from '..';

import SessionBackendServerApi from '../session_backend_server';
import { NetworkTime } from '../../../util/NetworkTime';
import { BlindingActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { UserUtils } from '../../utils';

const networkApiPubkey = 'cbf461a4431dc9174dceef4421680d743a2a0e1a3131fc794240bcb0bc3dd449';

export default class NetworkApi {
  static readonly server = new SessionBackendServerApi({
    name: 'NetworkApi',
    url: `http://${SERVER_HOSTS.NETWORK_SERVER}`,
    edPkHex: '',
    xPkHex: networkApiPubkey,
  });

  // NOTE: This is a debug function
  static async getValidateHeaders(): Promise<ValidateHeaderResponse> {
    const response = await NetworkApi.server.makeRequestWithSchema({
      path: '/validate/headers',
      method: 'GET',
      blindSignRequest: true,
      withZodSchema: ValidateHeaderSchema,
    });

    if (!response) {
      const ed25519SecretKey = (await UserUtils.getUserED25519KeyPairBytes()).privKeyBytes;
      const blindedPkHex = ed25519SecretKey
        ? await BlindingActions.blindVersionPubkey({
            ed25519SecretKey,
          })
        : '';

      return {
        status_code: 500,
        t: NetworkTime.nowSeconds(),
        success: false,
        blinded_id: blindedPkHex,
      };
    }

    return response;
  }

  static async getInfo(): Promise<InfoResponse | null> {
    return NetworkApi.server.makeRequestWithSchema({
      path: '/info',
      method: 'GET',
      blindSignRequest: true,
      withZodSchema: InfoSchema,
    });
  }
}
