import { OutgoingRawMessage } from '../types/RawMessage';

import { SnodeNamespaces } from '../apis/snode_api/namespaces';
import { ContentMessageNoProfile } from '../messages/outgoing';
import { PubKey } from '../types';

export function toRawMessage(
  destinationPubKey: PubKey,
  message: ContentMessageNoProfile,
  namespace: SnodeNamespaces
): OutgoingRawMessage {
  const ttl = message.ttl();
  const plainTextBuffer = message.plainTextBuffer();

  const rawMessage: OutgoingRawMessage = {
    identifier: message.identifier,
    plainTextBuffer,
    device: destinationPubKey.key,
    ttl,
    namespace,
    networkTimestampCreated: message.createAtNetworkTimestamp,
  };

  return rawMessage;
}
