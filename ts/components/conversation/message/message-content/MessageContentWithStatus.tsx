import { clsx } from 'clsx';
import styled from 'styled-components';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { MessageRenderingProps } from '../../../../models/messageType';
import { useMessageDirection } from '../../../../state/selectors';
import { Flex } from '../../../basic/Flex';
import { ExpirableReadableMessage } from '../message-item/ExpirableReadableMessage';
import { MessageAuthorText } from './MessageAuthorText';
import { MessageContent } from './MessageContent';
import type { WithMessageId } from '../../../../session/types/with';

export type MessageContentWithStatusSelectorProps = { isGroup: boolean } & Pick<
  MessageRenderingProps,
  'conversationType' | 'direction' | 'isDeleted'
>;

const StyledMessageContentContainer = styled.div<{ $isIncoming: boolean; $isDetailView: boolean }>`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: ${props => (props.$isIncoming ? 'flex-start' : 'flex-end')};

  width: 100%;
`;

const StyledMessageWithAuthor = styled.div`
  max-width: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: var(--margins-xs);
`;

export const MessageContentWithStatuses = ({ messageId }: WithMessageId) => {
  const isDetailView = useIsDetailMessageView();
  const _direction = useMessageDirection(messageId);

  if (!messageId) {
    return null;
  }

  // NOTE we want messages on the left in the message detail view regardless of direction
  const direction = isDetailView ? 'incoming' : _direction;
  const isIncoming = direction === 'incoming';

  return (
    <StyledMessageContentContainer $isIncoming={isIncoming} $isDetailView={isDetailView}>
      <ExpirableReadableMessage
        messageId={messageId}
        className={clsx('module-message', `module-message--${direction}`)}
        dataTestId="message-content"
      >
        <Flex
          $container={true}
          $flexDirection="column"
          $flexShrink={0}
          // we need this to prevent short messages from being misaligned (incoming)
          $alignItems={isIncoming ? 'flex-start' : 'flex-end'}
          $maxWidth="100%"
        >
          <StyledMessageWithAuthor>
            {!isDetailView && <MessageAuthorText messageId={messageId} />}
            <MessageContent messageId={messageId} />
          </StyledMessageWithAuthor>
        </Flex>
      </ExpirableReadableMessage>
    </StyledMessageContentContainer>
  );
};
