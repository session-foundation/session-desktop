import useAsyncFn from 'react-use/lib/useAsyncFn';
import { WithMessageId } from '../../../../session/types/with';
import { useMessageDirection, useMessageStatus } from '../../../../state/selectors';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { Data } from '../../../../data/data';
import { tr } from '../../../../localization/localeTools';
import { SessionLucideIconButton } from '../../../icon/SessionIconButton';
import { SpacerSM } from '../../../basic/Text';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';

export const RetryItem = ({ messageId }: WithMessageId) => {
  const direction = useMessageDirection(messageId);

  const status = useMessageStatus(messageId);
  const isOutgoing = direction === 'outgoing';

  const showRetry = status === 'error' && isOutgoing;

  const [, doResend] = useAsyncFn(async () => {
    const found = await Data.getMessageById(messageId);
    if (found) {
      await found.retrySend();
    }
  }, [messageId]);

  return showRetry ? (
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    <ItemWithDataTestId onClick={() => doResend()}>
      <SessionLucideIconButton
        iconSize="medium"
        iconColor="inherit"
        unicode={LUCIDE_ICONS_UNICODE.REPLY}
      />
      <SpacerSM />
      {tr('resend')}
    </ItemWithDataTestId>
  ) : null;
};
