import { isEmpty } from 'lodash';

import { MouseEvent } from 'react';
import { useSelector } from 'react-redux';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { MessageRenderingProps } from '../../../../models/messageType';
import { ToastUtils } from '../../../../session/utils';
import { openConversationToSpecificMessage } from '../../../../state/ducks/conversations';
import { StateType } from '../../../../state/reducer';
import { useMessageDirection } from '../../../../state/selectors';
import { getMessageQuoteProps } from '../../../../state/selectors/conversations';
import { Quote } from './quote/Quote';

type Props = {
  messageId: string;
};

export type MessageQuoteSelectorProps = Pick<MessageRenderingProps, 'quote' | 'direction'>;

export const MessageQuote = (props: Props) => {
  const quoteProps = useSelector((state: StateType) =>
    getMessageQuoteProps(state, props.messageId)
  );
  const direction = useMessageDirection(props.messageId);
  const isMessageDetailView = useIsDetailMessageView();

  if (!quoteProps || isEmpty(quoteProps)) {
    return null;
  }

  const onQuoteClick = async (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isMessageDetailView) {
      return;
    }

    if (!quoteProps || quoteProps.referencedMessageNotFound) {
      ToastUtils.pushOriginalNotFound();
      window.log.warn('onQuoteClick: quote not valid');
      return;
    }

    const conversationKey = quoteProps.convoId;
    const messageIdToNavigateTo = quoteProps.id;

    if (messageIdToNavigateTo) {
      void openConversationToSpecificMessage({
        conversationKey,
        messageIdToNavigateTo,
        shouldHighlightMessage: true,
      });
      return;
    }
    ToastUtils.pushOriginalNotFound();
  };

  if (quoteProps.referencedMessageNotFound) {
    return (
      <Quote
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={onQuoteClick}
        referencedMessageNotFound={true}
        text={undefined}
        attachment={undefined}
        isIncoming={direction === 'incoming'}
        author={quoteProps.author}
        isFromMe={false}
      />
    );
  }

  return (
    <Quote
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onClick={onQuoteClick}
      text={quoteProps?.text}
      attachment={quoteProps?.attachment}
      isIncoming={direction === 'incoming'}
      author={quoteProps.author}
      referencedMessageNotFound={false}
      isFromMe={Boolean(quoteProps.isFromMe)}
    />
  );
};
