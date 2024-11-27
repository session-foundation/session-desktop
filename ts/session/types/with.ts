import { PubkeyType } from 'libsession_util_nodejs';

export type WithMessageHash = { messageHash: string };
export type WithTimestamp = { timestamp: number };
export type WithSignature = { signature: string };
export type WithSecretKey = { secretKey: Uint8Array };

export type WithFromMemberLeftMessage = { fromMemberLeftMessage: boolean }; // there are some changes we want to skip when doing changes triggered from a memberLeft message.

export type WithAddWithoutHistoryMembers = { withoutHistory: Array<PubkeyType> };
export type WithAddWithHistoryMembers = { withHistory: Array<PubkeyType> };
export type WithRemoveMembers = { removed: Array<PubkeyType> };
export type WithPromotedMembers = { promoted: Array<PubkeyType> };

export type WithMaxSize = { max_size?: number };
export type WithShortenOrExtend = { shortenOrExtend: 'shorten' | 'extend' | '' };
export type WithCreatedAtNetworkTimestamp = { createdAtNetworkTimestamp: number };
export type WithMethod<T extends string> = { method: T };
