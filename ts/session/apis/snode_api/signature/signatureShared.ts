import { GroupPubkeyType, Uint8ArrayLen100, Uint8ArrayLen64 } from 'libsession_util_nodejs';
import { isEmpty } from 'lodash';
import { getSodiumRenderer } from '../../../crypto';
import { PubKey } from '../../../types';
import { StringUtils } from '../../../utils';
import { fromUInt8ArrayToBase64 } from '../../../utils/String';
import { NetworkTime } from '../../../../util/NetworkTime';

export type SnodeSigParamsShared = {
  namespace: number | null | 'all'; // 'all' can be used to clear all namespaces (during account deletion)
  method: 'retrieve' | 'store' | 'delete_all';
};

export type SnodeSigParamsAdminGroup = SnodeSigParamsShared & {
  groupPk: GroupPubkeyType;
  /**
   * privKey, length of 64 bytes
   */
  privKey: Uint8ArrayLen64;
};

export type SnodeSigParamsSubAccount = SnodeSigParamsShared & {
  groupPk: GroupPubkeyType;
  /**
   * authData, length of 100 bytes
   */
  authData: Uint8ArrayLen100;
};

export type SnodeSigParamsUs = SnodeSigParamsShared & {
  pubKey: string;
  /**
   * privKey, length of 64 bytes
   */
  privKey: Uint8ArrayLen64;
};

function getVerificationDataForStoreRetrieve(params: SnodeSigParamsShared) {
  const signatureTimestamp = NetworkTime.now();
  const verificationString = `${params.method}${
    params.namespace === 0 ? '' : params.namespace
  }${signatureTimestamp}`;
  const verificationData = StringUtils.encode(verificationString, 'utf8');
  return {
    toSign: new Uint8Array(verificationData),
    signatureTimestamp,
  };
}

function isSigParamsForGroupAdmin(
  sigParams: SnodeSigParamsAdminGroup | SnodeSigParamsUs | SnodeSigParamsSubAccount
): sigParams is SnodeSigParamsAdminGroup {
  const toValidate = sigParams as SnodeSigParamsAdminGroup;
  return PubKey.is03Pubkey(toValidate.groupPk) && !isEmpty(toValidate.privKey);
}

async function getSnodeSignatureShared(params: SnodeSigParamsAdminGroup | SnodeSigParamsUs) {
  const { signatureTimestamp, toSign } = getVerificationDataForStoreRetrieve(params);

  try {
    const sodium = await getSodiumRenderer();
    const signature = sodium.crypto_sign_detached(toSign, params.privKey);
    const signatureBase64 = fromUInt8ArrayToBase64(signature);
    if (isSigParamsForGroupAdmin(params)) {
      return {
        timestamp: signatureTimestamp,
        signature: signatureBase64,
        pubkey: params.groupPk,
      };
    }
    return {
      timestamp: signatureTimestamp,
      signature: signatureBase64,
    };
  } catch (e) {
    window.log.warn('getSnodeShared failed with: ', e.message);
    throw e;
  }
}

export const SignatureShared = {
  getSnodeSignatureShared,
  getVerificationDataForStoreRetrieve,
};
