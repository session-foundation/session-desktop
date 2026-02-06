import {
  MetaGroupWrapperActions,
  MultiEncryptWrapperActions,
} from '../../webworker/workers/browser/libsession_worker_interface';
import { PubKey } from '../types';
import { UserUtils } from '../utils';

type SharedEncryptAndWrap = {
  ttl: number;
  dbMessageIdentifier: string;
  isSyncMessage: boolean;
  plainTextBuffer: Uint8Array;
};

type EncryptAndWrapMessage = {
  destination: string;
  namespace: number;
  networkTimestamp: number;
} & SharedEncryptAndWrap;

export type EncryptAndWrapMessageResults = {
  networkTimestamp: number;
  encryptedAndWrappedData: Uint8Array;
  namespace: number;
} & SharedEncryptAndWrap;

async function encryptForGroup(
  params: EncryptAndWrapMessage
): Promise<EncryptAndWrapMessageResults> {
  // Group v2 encryption works a bit differently: we encrypt the envelope itself through libsession.
  // We essentially need to do the opposite of the usual encryption which is send envelope unencrypted with content encrypted.
  const {
    destination,
    dbMessageIdentifier,
    isSyncMessage: syncMessage,
    namespace,
    plainTextBuffer,
    ttl,
    networkTimestamp,
  } = params;

  if (!PubKey.is03Pubkey(destination)) {
    throw new Error('encryptForGroup rawMessage was given invalid pubkey');
  }

  const groupEncKeyHex = await MetaGroupWrapperActions.keyGetEncryptionKeyHex(destination);
  const proRotatingPrivateKey = await UserUtils.getProRotatingPrivateKeyHex();

  const cipherText = await MultiEncryptWrapperActions.encryptForGroup([
    {
      plaintext: plainTextBuffer,
      sentTimestampMs: networkTimestamp,
      groupEd25519Pubkey: destination,
      groupEncKey: groupEncKeyHex,
      senderEd25519Seed: await UserUtils.getUserEd25519Seed(),
      proRotatingEd25519PrivKey: proRotatingPrivateKey,
    },
  ]);

  return {
    networkTimestamp,
    encryptedAndWrappedData: cipherText.encryptedData[0],
    namespace,
    ttl,
    dbMessageIdentifier,
    isSyncMessage: syncMessage,
    plainTextBuffer,
  };
}

async function encryptMessageAndWrap(
  params: EncryptAndWrapMessage
): Promise<EncryptAndWrapMessageResults> {
  const {
    destination,
    dbMessageIdentifier,
    isSyncMessage: syncMessage,
    namespace,
    plainTextBuffer,
    ttl,
    networkTimestamp,
  } = params;

  if (PubKey.is03Pubkey(destination)) {
    return encryptForGroup(params);
  }
  if (!PubKey.is05Pubkey(destination)) {
    throw new Error('encryptMessageAndWrap: now, this could only be a 05 pubkey');
  }
  const proRotatingPrivateKey = await UserUtils.getProRotatingPrivateKeyHex();

  const encryptedAndWrappedData = await MultiEncryptWrapperActions.encryptFor1o1([
    {
      plaintext: plainTextBuffer,
      sentTimestampMs: networkTimestamp,
      recipientPubkey: destination,
      senderEd25519Seed: await UserUtils.getUserEd25519Seed(),
      proRotatingEd25519PrivKey: proRotatingPrivateKey,
    },
  ]);

  return {
    encryptedAndWrappedData: encryptedAndWrappedData.encryptedData[0],
    networkTimestamp,
    namespace,
    ttl,
    dbMessageIdentifier,
    isSyncMessage: syncMessage,
    plainTextBuffer,
  };
}

async function encryptMessagesAndWrap(
  messages: Array<EncryptAndWrapMessage>
): Promise<Array<EncryptAndWrapMessageResults>> {
  return Promise.all(messages.map(encryptMessageAndWrap));
}

export const MessageWrapper = {
  encryptMessagesAndWrap,
};
