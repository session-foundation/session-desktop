import { GroupPubkeyType, PubkeyType } from 'libsession_util_nodejs';

import { SnodeNamespaces } from './namespaces';
import { SubaccountRevokeSubRequest, SubaccountUnrevokeSubRequest } from './SnodeRequestTypes';
import { WithSignature, WithTimestamp } from '../../types/with';

export type RetrieveMessageItem = {
  /**
   * The message hash as stored on the snode
   */
  hash: string;
  /**
   * When the message is set to expire on the snode.
   */
  expiration: number;
  /**
   * base64 encrypted content of the message
   */
  data: string;
  /**
   * **not** the envelope timestamp, but when the message was effectively stored on the snode
   */
  storedAt: number;
};

export type RetrieveMessageItemWithNamespace = RetrieveMessageItem & {
  namespace: SnodeNamespaces; // the namespace from which this message was fetched
};

export type RetrieveMessagesResultsContent = {
  hf?: Array<number>;
  messages?: Array<RetrieveMessageItem>;
  more: boolean;
  t: number;
};

type RetrieveMessagesResultsContentMerged = Pick<RetrieveMessagesResultsContent, 'messages'>;

type RetrieveRequestResult<
  T extends RetrieveMessagesResultsContent | RetrieveMessagesResultsContentMerged,
> = {
  code: number;
  messages: T;
  namespace: SnodeNamespaces;
};
export type RetrieveMessagesResultsBatched = Array<
  RetrieveRequestResult<RetrieveMessagesResultsContent>
>;
export type RetrieveMessagesResultsMergedBatched = Array<
  RetrieveRequestResult<RetrieveMessagesResultsContentMerged>
>;

export type WithRevokeSubRequest = {
  revokeSubRequest?: SubaccountRevokeSubRequest;
  unrevokeSubRequest?: SubaccountUnrevokeSubRequest;
};

export type SignedHashesParams = WithSignature & {
  pubkey: PubkeyType;
  pubkey_ed25519: PubkeyType;
  messages: Array<string>;
};

export type SignedGroupHashesParams = WithTimestamp &
  WithSignature & {
    pubkey: GroupPubkeyType;
    messages: Array<string>;
  };

/** Inherits from  https://api.oxen.io/storage-rpc/#/recursive?id=recursive but we only care about these values
 *
 * The signature uses the node's ed25519 pubkey.
 *( PUBKEY_HEX || EXPIRY || RMSGs... || UMSGs... || CMSG_EXPs... )
 * where RMSGs are the requested expiry hashes,
 * UMSGs are the actual updated hashes, and
 * CMSG_EXPs are (HASH || EXPIRY) values, ascii-sorted by hash, for the unchanged message hashes included in the "unchanged" field.
 */
export type ExpireMessageResultItem = WithSignature & {
  /** the expiry timestamp that was applied (which might be different from the request expiry */
  expiry: number;
  /** Record of <found hashes, current expiries>, but did not get updated due to "shorten"/"extend" in the request. This field is only included when "shorten /extend" is explicitly given. */
  unchanged?: Record<string, number>;
  /** ascii-sorted list of hashes that had their expiries changed (messages that were not found, and messages excluded by the shorten/extend options, are not included) */
  updated: Array<string>;
  failed?: boolean;
};

/** <pubkey, ExpireMessageResultItem> */
export type ExpireMessagesResultsContent = Record<string, ExpireMessageResultItem>;

/** <messageHash, expiry (milliseconds since unix epoch)>
 *
 * NOTE Only messages that exist on the server are included */
export type GetExpiriesResultsContent = Record<string, number>;
