import { PubKey } from '../../../../session/types';

/**
 * We want to show the copyId for private and not blinded chats only
 */
export function showCopyAccountIdAction({
  isPrivate,
  pubkey,
}: {
  isPrivate: boolean;
  pubkey: string;
}) {
  return isPrivate && !PubKey.isBlinded(pubkey);
}
