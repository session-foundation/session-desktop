import { SnodeNamespaces } from '../apis/snode_api/namespaces';

export type OutgoingRawMessage = {
  dbMessageIdentifier: string;
  plainTextBuffer: Uint8Array;
  device: string;
  ttl: number; // ttl is in ms
  networkTimestampCreated: number;
  namespace: SnodeNamespaces;
};

export type StoredRawMessage = Pick<
  OutgoingRawMessage,
  'dbMessageIdentifier' | 'device' | 'ttl' | 'networkTimestampCreated'
> & {
  plainTextBufferHex: string;
  namespace: number; // read it as number, we need to check that it is indeed a valid namespace once loaded
};
