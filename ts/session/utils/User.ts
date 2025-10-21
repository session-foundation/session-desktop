import { PubkeyType } from 'libsession_util_nodejs';
import _ from 'lodash';
import { UserUtils } from '.';
import { Data } from '../../data/data';
import { SessionKeyPair } from '../../receiver/keypairs';
import { getOurPubKeyStrFromStorage } from '../../util/storage';
import { PubKey } from '../types';
import { toHex } from './String';
import { UserConfigWrapperActions } from '../../webworker/workers/browser/libsession_worker_interface';
import { OutgoingUserProfile } from '../../types/message';

export type HexKeyPair = {
  pubKey: string;
  privKey: string;
};

export type ByteKeyPair = {
  pubKeyBytes: Uint8Array;
  privKeyBytes: Uint8Array;
};

/**
 * Check if this pubkey is us, using the cache.
 * This does not check for us blinded. To check for us or us blinded, use isUsAnySogsFromCache()
 * Throws an error if our pubkey is not set
 */
export function isUsFromCache(pubKey: string | PubKey | undefined): boolean {
  if (!pubKey) {
    throw new Error('pubKey is not set');
  }
  const ourNumber = UserUtils.getOurPubKeyStrFromCache();
  const pubKeyStr = pubKey instanceof PubKey ? pubKey.key : pubKey;
  return pubKeyStr === ourNumber;
}

/**
 * Returns the public key of this current device as a STRING, or throws an error
 */
export function getOurPubKeyStrFromCache(): PubkeyType {
  const ourNumber = getOurPubKeyStrFromStorage();
  if (!ourNumber) {
    throw new Error('ourNumber is not set');
  }

  return ourNumber as PubkeyType;
}

/**
 * Returns the public key of this current device as a PubKey, or throws an error
 */
export function getOurPubKeyFromCache(): PubKey {
  const ourNumber = UserUtils.getOurPubKeyStrFromCache();
  if (!ourNumber) {
    throw new Error('ourNumber is not set');
  }
  return PubKey.cast(ourNumber);
}

let cachedIdentityKeyPair: SessionKeyPair | undefined;

/**
 * This return the stored x25519 identity keypair for the current logged in user
 */
export async function getIdentityKeyPair(): Promise<SessionKeyPair | undefined> {
  if (cachedIdentityKeyPair) {
    return cachedIdentityKeyPair;
  }
  const item = await Data.getItemById('identityKey');

  cachedIdentityKeyPair = item?.value;
  return cachedIdentityKeyPair;
}

export async function getUserED25519KeyPair(): Promise<HexKeyPair> {
  const ed25519KeyPairBytes = await getUserED25519KeyPairBytes();
  if (!ed25519KeyPairBytes) {
    throw new Error('getUserED25519KeyPair: user has no keypair');
  }
  const { pubKeyBytes, privKeyBytes } = ed25519KeyPairBytes;
  return {
    pubKey: toHex(pubKeyBytes),
    privKey: toHex(privKeyBytes),
  };
}

export const getUserED25519KeyPairBytes = async (): Promise<ByteKeyPair> => {
  // 'identityKey' keeps the ed25519KeyPair under a ed25519KeyPair field.
  // it is only set if the user migrated to the ed25519 way of generating a key
  const item = await UserUtils.getIdentityKeyPair();
  const ed25519KeyPair = (item as any)?.ed25519KeyPair;
  if (ed25519KeyPair?.publicKey && ed25519KeyPair?.privateKey) {
    const pubKeyBytes = new Uint8Array(_.map(ed25519KeyPair.publicKey, a => a));
    const privKeyBytes = new Uint8Array(_.map(ed25519KeyPair.privateKey, a => a));
    return {
      pubKeyBytes,
      privKeyBytes,
    };
  }
  throw new Error('getUserED25519KeyPairBytes: user has no keypair');
};

/**
 * Return the ed25519 seed of the current user. (32 bytes)
 * This is used to generate deterministic encryption keys for attachments/profile pictures.
 *
 * This is cached so will only be slow on the first fetch.
 */
export async function getUserEd25519Seed() {
  return (await getUserEd25519PrivKey()).slice(0, 32);
}

async function getUserEd25519PrivKey() {
  const ed25519KeyPairBytes = await getUserED25519KeyPairBytes();
  return ed25519KeyPairBytes.privKeyBytes;
}

export async function getOurProfile() {
  const displayName = (await UserConfigWrapperActions.getName()) || 'Anonymous';
  const updatedAtSeconds = await UserConfigWrapperActions.getProfileUpdatedSeconds();
  const profilePic = await UserConfigWrapperActions.getProfilePic();

  return new OutgoingUserProfile({
    displayName,
    updatedAtSeconds,
    profilePic: profilePic ?? null,
  });
}
