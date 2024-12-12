import { useCallback } from 'react';
import { WithMessageId } from '../../../../session/types/with';
import { useMessageDirection, useMessageStatus } from '../../../../state/selectors';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { Data } from '../../../../data/data';

export const RetryItem = ({ messageId }: WithMessageId) => {
  const direction = useMessageDirection(messageId);

  const status = useMessageStatus(messageId);
  const isOutgoing = direction === 'outgoing';

  const showRetry = status === 'error' && isOutgoing;
  const onRetry = useCallback(async () => {
    const found = await Data.getMessageById(messageId);
    if (found) {
      await found.retrySend();
    }
  }, [messageId]);

  return showRetry ? (
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    <ItemWithDataTestId onClick={onRetry}>{window.i18n('resend')}</ItemWithDataTestId>
  ) : null;
};
