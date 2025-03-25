import { OutgoingRawMessage } from '../types/RawMessage';

import { SignalService } from '../../protobuf';
import { SnodeNamespaces } from '../apis/snode_api/namespaces';
import { ContentMessage } from '../messages/outgoing';
import { PubKey } from '../types';

function getEncryptionTypeFromMessageType(isGroup = false): SignalService.Envelope.Type {
  if (isGroup) {
    return SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE;
  }
  return SignalService.Envelope.Type.SESSION_MESSAGE;
}

export async function toRawMessage(
  destinationPubKey: PubKey,
  message: ContentMessage,
  namespace: SnodeNamespaces,
  isGroup = false
): Promise<OutgoingRawMessage> {
  const ttl = message.ttl();
  const plainTextBuffer = message.plainTextBuffer();
  const is03group = PubKey.is03Pubkey(destinationPubKey.key);

  const encryption = getEncryptionTypeFromMessageType(isGroup || is03group);

  const rawMessage: OutgoingRawMessage = {
    identifier: message.identifier,
    plainTextBuffer,
    device: destinationPubKey.key,
    ttl,
    encryption,
    namespace,
    networkTimestampCreated: message.createAtNetworkTimestamp,
  };

  return rawMessage;
}
