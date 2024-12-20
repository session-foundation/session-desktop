import { PubkeyType, WithGroupPubkey } from 'libsession_util_nodejs';

export type FindAllMessageFromSendersInConversationTypeArgs = WithGroupPubkey & {
  toRemove: Array<PubkeyType>;
  signatureTimestamp: number;
};

export type FindAllMessageHashesInConversationTypeArgs = WithGroupPubkey & {
  messageHashes: Array<string>;
  signatureTimestamp: number;
};

export type FindAllMessageHashesInConversationMatchingAuthorTypeArgs = WithGroupPubkey & {
  messageHashes: Array<string>;
  author: PubkeyType;
  signatureTimestamp: number;
};
