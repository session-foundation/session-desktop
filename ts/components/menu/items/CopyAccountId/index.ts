import { PubKey } from '../../../../session/types';

export function showCopyAccountIdAction({
  isPrivate,
  pubkey,
}: {
  isPrivate: boolean;
  pubkey: string;
}) {
  return isPrivate && !PubKey.isBlinded(pubkey);
}
