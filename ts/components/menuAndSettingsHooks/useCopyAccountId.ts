import { useIsPrivate } from '../../hooks/useParamSelector';
import { PubKey } from '../../session/types';
import { ToastUtils } from '../../session/utils';
import { useMessageDirection } from '../../state/selectors';

function useShowCopyAccountId({ sender, messageId }: { sender?: string; messageId?: string }) {
  const isPrivate = useIsPrivate(sender);
  const direction = useMessageDirection(messageId);
  const isOutgoing = direction === 'outgoing';

  // we cannot copy the account if on a message that we sent
  return sender && isPrivate && !PubKey.isBlinded(sender) && (!messageId || !isOutgoing);
}

export function useShowCopyAccountIdCb({
  sender,
  messageId,
}: {
  sender?: string;
  messageId?: string;
}) {
  const canCopy = useShowCopyAccountId({ sender, messageId });

  if (!canCopy || !sender) {
    return null;
  }

  return () => {
    window.clipboard.writeText(sender);
    ToastUtils.pushCopiedToClipBoard();
  };
}
