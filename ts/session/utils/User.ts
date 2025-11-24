import { to_hex } from 'libsodium-wrappers-sumo';
import { PubkeyType } from 'libsession_util_nodejs';
import _, { isEmpty, isString } from 'lodash';
import { UserUtils } from '.';
import { Data } from '../../data/data';
import { SessionKeyPair } from '../../receiver/keypairs';
import { getOurPubKeyStrFromStorage } from '../../util/storage';
import { PubKey } from '../types';
import { toHex } from './String';
import {
  ProWrapperActions,
  UserConfigWrapperActions,
} from '../../webworker/workers/browser/libsession_worker_interface';
import { OutgoingUserProfile } from '../../types/message';
import { SettingsKey } from '../../data/settings-key';
import { OutgoingProMessageDetails } from '../../types/message/OutgoingProMessageDetails';

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
  const item = await Data.getItemById(SettingsKey.identityKey);

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
  const [displayName, updatedAtSeconds, profilePic] = await Promise.all([
    UserConfigWrapperActions.getName(),
    UserConfigWrapperActions.getProfileUpdatedSeconds(),
    UserConfigWrapperActions.getProfilePic(),
  ]);

  return new OutgoingUserProfile({
    displayName: displayName || 'Anonymous',
    updatedAtSeconds,
    profilePic: profilePic ?? null,
  });
}

export async function getOutgoingProMessageDetails({
  utf16,
}: {
  utf16: string | null | undefined;
}) {
  const [proConfig, proFeaturesUserBitset] = await Promise.all([
    UserConfigWrapperActions.getProConfig(),
    UserConfigWrapperActions.getProFeaturesBitset(),
  ]);
  // Note: if we do not have a proof we don't want to send a proMessage.
  // Note: if we don't have a user pro feature enabled, we might still need to add one for the message itself, see below
  if (!proConfig || isEmpty(proConfig?.proProof)) {
    return null;
  }

  const proFeaturesForMsg = await ProWrapperActions.proFeaturesForMessage({
    proFeaturesBitset: proFeaturesUserBitset,
    utf16: utf16 ?? '',
  });

  if (proFeaturesForMsg.status !== 'SUCCESS') {
    return null;
  }
  return new OutgoingProMessageDetails({
    proConfig,
    proFeaturesBitset: proFeaturesForMsg.proFeaturesBitset,
  });
}

/**
 * Return the pro master key hex from the Item table, or generate and saves it before returning it.
 */
export async function getProMasterKeyHex() {
  const item = await Data.getItemById(SettingsKey.proMasterKeyHex);
  if (!item?.value && isString(item?.value) && item.value.length) {
    return item.value;
  }
  const seedHex = to_hex(await UserUtils.getUserEd25519Seed());
  const { proMasterKeyHex } = await UserConfigWrapperActions.generateProMasterKey({
    ed25519SeedHex: seedHex,
  });
  if (!proMasterKeyHex) {
    throw new Error('Failed to generate pro master key');
  }
  await Data.createOrUpdateItem({
    id: SettingsKey.proMasterKeyHex,
    value: proMasterKeyHex,
  });
  return proMasterKeyHex;
}

/**
 * Return the pro rotating private key (hex) from user config, or generate it before returning it.
 */
export async function getProRotatingPrivateKeyHex() {
  const proConfig = await UserConfigWrapperActions.getProConfig();
  if (proConfig?.rotatingPrivKeyHex) {
    return proConfig.rotatingPrivKeyHex;
  }

  const { rotatingPrivKeyHex } = await UserConfigWrapperActions.generateRotatingPrivKeyHex();
  if (!rotatingPrivKeyHex) {
    throw new Error('Failed to generate pro rotating private key');
  }
  return rotatingPrivKeyHex;
}
