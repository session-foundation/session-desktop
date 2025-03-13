import { SignalService } from '../../protobuf';
import { ConvoHub } from '../conversations';
import { MessageEncrypter } from '../crypto/MessageEncrypter';
import { PubKey } from '../types';

function encryptionBasedOnConversation(destination: PubKey) {
  if (PubKey.is03Pubkey(destination.key) || ConvoHub.use().get(destination.key)?.isClosedGroup()) {
    return SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE;
  }
  return SignalService.Envelope.Type.SESSION_MESSAGE;
}

type SharedEncryptAndWrap = {
  ttl: number;
  identifier: string;
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

async function encryptForGroupV2(
  params: EncryptAndWrapMessage
): Promise<EncryptAndWrapMessageResults> {
  // Group v2 encryption works a bit differently: we encrypt the envelope itself through libsession.
  // We essentially need to do the opposite of the usual encryption which is send envelope unencrypted with content encrypted.
  const {
    destination,
    identifier,
    isSyncMessage: syncMessage,
    namespace,
    plainTextBuffer,
    ttl,
    networkTimestamp,
  } = params;

  const envelope = MessageWrapper.wrapContentIntoEnvelope(
    SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE,
    destination,
    networkTimestamp,
    plainTextBuffer
  );

  const recipient = PubKey.cast(destination);

  const { cipherText } = await MessageEncrypter.encrypt(
    recipient,
    SignalService.Envelope.encode(envelope).finish(),
    encryptionBasedOnConversation(recipient)
  );

  return {
    networkTimestamp,
    encryptedAndWrappedData: cipherText,
    namespace,
    ttl,
    identifier,
    isSyncMessage: syncMessage,
    plainTextBuffer,
  };
}

function wrapContentIntoEnvelope(
  type: SignalService.Envelope.Type,
  sskSource: string | undefined,
  timestamp: number,
  content: Uint8Array
): SignalService.Envelope {
  let source: string | undefined;

  if (type === SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE) {
    source = sskSource;
  }

  return SignalService.Envelope.create({
    type,
    source,
    timestamp,
    content,
  });
}
/**
 * This is an outdated practice and we should probably just send the envelope data directly.
 * Something to think about in the future.
 */
function wrapEnvelopeInWebSocketMessage(envelope: SignalService.Envelope): Uint8Array {
  const request = SignalService.WebSocketRequestMessage.create({
    id: 0,
    body: SignalService.Envelope.encode(envelope).finish(),
    verb: 'PUT',
    path: '/api/v1/message',
  });

  const websocket = SignalService.WebSocketMessage.create({
    type: SignalService.WebSocketMessage.Type.REQUEST,
    request,
  });
  return SignalService.WebSocketMessage.encode(websocket).finish();
}

async function encryptMessageAndWrap(
  params: EncryptAndWrapMessage
): Promise<EncryptAndWrapMessageResults> {
  const {
    destination,
    identifier,
    isSyncMessage: syncMessage,
    namespace,
    plainTextBuffer,
    ttl,
    networkTimestamp,
  } = params;

  if (PubKey.is03Pubkey(destination)) {
    return encryptForGroupV2(params);
  }

  // can only be legacy group or 1o1 chats here

  const recipient = PubKey.cast(destination);

  const { envelopeType, cipherText } = await MessageEncrypter.encrypt(
    recipient,
    plainTextBuffer,
    encryptionBasedOnConversation(recipient)
  );

  const envelope = MessageWrapper.wrapContentIntoEnvelope(
    envelopeType,
    recipient.key,
    networkTimestamp,
    cipherText
  );
  const data = MessageWrapper.wrapEnvelopeInWebSocketMessage(envelope);

  return {
    encryptedAndWrappedData: data,
    networkTimestamp,
    namespace,
    ttl,
    identifier,
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
  wrapEnvelopeInWebSocketMessage,
  wrapContentIntoEnvelope,
  encryptMessagesAndWrap,
};
