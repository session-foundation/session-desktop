import { useIsPrivate } from '../../hooks/useParamSelector';
import { showCopyAccountIdAction } from '../menu/items/CopyAccountId/guard';

export function useShowCopyAccountId(conversationId: string) {
  const isPrivate = useIsPrivate(conversationId);

  return showCopyAccountIdAction({ isPrivate, pubkey: conversationId });
}
