import _, { range } from 'lodash';
import { isTestNet } from '../../../shared/env_vars';
import { getSodiumRenderer } from '../../crypto';
import {
  fromHexToArray,
  fromUInt8ArrayToBase64,
  stringToUint8Array,
  toHex,
} from '../../utils/String';
import { NotFoundError } from '../../utils/errors';
import { OnsResolveSubRequest } from './SnodeRequestTypes';
import { BatchRequests } from './batchRequest';
import { GetNetworkTime } from './getNetworkTime';
import { SnodePool } from './snodePool';
import { DURATION } from '../../constants';

// ONS name can have [a-zA-Z0-9_-] except that - is not allowed as start or end
// do not define a regex but rather create it on the fly to avoid https://stackoverflow.com/questions/3891641/regex-test-only-works-every-other-time
const onsNameRegex = '^\\w([\\w-]*[\\w])?$';

async function getSessionIDForOnsName(onsNameCase: string) {
  const validationCount = 3;

  const onsNameLowerCase = onsNameCase.toLowerCase();
  const sodium = await getSodiumRenderer();
  const nameAsData = stringToUint8Array(onsNameLowerCase);
  const nameHash = sodium.crypto_generichash(sodium.crypto_generichash_BYTES, nameAsData);
  const base64EncodedNameHash = fromUInt8ArrayToBase64(nameHash);
  const subRequest = new OnsResolveSubRequest(base64EncodedNameHash);
  if (isTestNet()) {
    window.log.info('OnsResolve response are not registered to anything on testnet');
    throw new Error('OnsResolve response are not registered to anything on testnet');
  }

  // we do this request with validationCount snodes
  const promises = range(0, validationCount).map(async () => {
    const targetNode = await SnodePool.getRandomSnode();

    const results = await BatchRequests.doUnsignedSnodeBatchRequestNoRetries({
      unsignedSubRequests: [subRequest],
      targetNode,
      timeoutMs: 10 * DURATION.SECONDS,
      associatedWith: null,
      allow401s: false,
      method: 'batch',
      abortSignal: null,
    });
    const firstResult = results[0];
    if (!firstResult || firstResult.code !== 200 || !firstResult.body) {
      throw new Error('OnsResolve :Failed to resolve ONS');
    }
    const parsedBody = firstResult.body;
    GetNetworkTime.handleTimestampOffsetFromNetwork('ons_resolve', parsedBody.t);

    const intermediate = parsedBody?.result;

    if (!intermediate || !intermediate?.encrypted_value) {
      throw new NotFoundError('OnsResolve: no encrypted_value');
    }
    const hexEncodedCipherText = intermediate?.encrypted_value;

    const ciphertext = fromHexToArray(hexEncodedCipherText);
    let key: Uint8Array;
    // we dropped support for argon2 based ons

    const hexEncodedNonce = intermediate.nonce as string;
    if (!hexEncodedNonce) {
      throw new Error('OnsResolve: No hexEncodedNonce');
    }
    const nonce = fromHexToArray(hexEncodedNonce);

    try {
      key = sodium.crypto_generichash(sodium.crypto_generichash_BYTES, nameAsData, nameHash);
      if (!key) {
        throw new Error('OnsResolve: Hashing failed');
      }
    } catch (e) {
      window?.log?.warn('OnsResolve: hashing failed', e);
      throw new Error('OnsResolve: Hashing failed');
    }

    const sessionIDAsData = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      null,
      nonce,
      key
    );

    if (!sessionIDAsData) {
      throw new Error('OnsResolve: Decryption failed');
    }

    return toHex(sessionIDAsData);
  });

  try {
    // if one promise throws, we end un the catch case
    const allResolvedSessionIds = await Promise.all(promises);
    if (allResolvedSessionIds?.length !== validationCount) {
      throw new Error('OnsResolve: Validation failed');
    }

    // assert all the returned account ids are the same
    if (_.uniq(allResolvedSessionIds).length !== 1) {
      throw new Error('OnsResolve: Validation failed');
    }
    return allResolvedSessionIds[0];
  } catch (e) {
    window.log.warn('OnsResolve: error', e);
    throw e;
  }
}

export const ONSResolve = { onsNameRegex, getSessionIDForOnsName };
