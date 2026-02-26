import { MouseEvent, useMemo } from 'react';
import { clsx } from 'clsx';
import styled from 'styled-components';
import { getAppDispatch } from '../../../../state/dispatch';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { updateReactListModal } from '../../../../state/ducks/modalDialog';
import {
  useHideAvatarInMsgList,
  useMessageDirection,
  useMessageIsOnline,
} from '../../../../state/selectors';
import { Flex } from '../../../basic/Flex';
import { ExpirableReadableMessage } from '../message-item/ExpirableReadableMessage';
import { MessageAuthorText } from './MessageAuthorText';
import { MessageContent } from './MessageContent';
import { MessageReactions } from './MessageReactions';
import { MessageStatus } from './MessageStatus';
import {
  useSelectedConversationKey,
  useSelectedIsLegacyGroup,
} from '../../../../state/selectors/selectedConversation';
import { SessionEmojiReactBarPopover } from '../../SessionEmojiReactBarPopover';
import { type WithPopoverPosition, type WithSetPopoverPosition } from '../../../SessionTooltip';
import { useReactToMessage, useReply } from '../../../../hooks/useMessageInteractions';
import { ConvoHub } from '../../../../session/conversations';
import type { WithContextMenuId, WithMessageId } from '../../../../session/types/with';

const StyledMessageContentContainer = styled.div<{ $isIncoming: boolean; $isDetailView: boolean }>`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: ${props => (props.$isIncoming ? 'flex-start' : 'flex-end')};
  padding-left: ${props => (props.$isDetailView || props.$isIncoming ? 0 : '25%')};
  padding-right: ${props => (props.$isDetailView || !props.$isIncoming ? 0 : '25%')};
  width: 100%;
`;

const StyledMessageWithAuthor = styled.div`
  max-width: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: var(--margins-xs);
`;

export const MessageContentWithStatuses = (
  props: WithMessageId & WithContextMenuId & WithPopoverPosition & WithSetPopoverPosition
) => {
  const { messageId, contextMenuId, triggerPosition, setTriggerPosition } = props;
  const dispatch = getAppDispatch();
  const _direction = useMessageDirection(messageId);
  const reactToMessage = useReactToMessage(messageId);
  const reply = useReply(messageId);
  const hideAvatar = useHideAvatarInMsgList(messageId);
  const isDetailView = useIsDetailMessageView();
  const isLegacyGroup = useSelectedIsLegacyGroup();

  const convoId = useSelectedConversationKey();
  const msgIsOnline = useMessageIsOnline(messageId);

  const onDoubleClickReplyToMessage = (e: MouseEvent<HTMLDivElement>) => {
    if (isLegacyGroup || !reply) {
      return;
    }
    const currentSelection = window.getSelection();
    const currentSelectionString = currentSelection?.toString() || undefined;

    if ((e.target as any).localName !== 'em-emoji-picker') {
      if (
        !currentSelectionString ||
        currentSelectionString.length === 0 ||
        !/\s/.test(currentSelectionString)
      ) {
        // if multiple word are selected, consider that this double click was actually NOT used to reply to
        // but to select
        void reply();
        currentSelection?.empty();
        e.preventDefault();
      }
    }
  };

  const convoReactionsEnabled = useMemo(() => {
    if (convoId) {
      const conversationModel = ConvoHub.use().get(convoId);
      if (conversationModel) {
        return conversationModel.hasReactions();
      }
    }
    return true;
  }, [convoId]);

  if (!messageId) {
    return null;
  }

  // NOTE we want messages on the left in the message detail view regardless of direction
  const direction = isDetailView ? 'incoming' : _direction;
  const isIncoming = direction === 'incoming';

  const enableReactions = convoReactionsEnabled && msgIsOnline;

  const handlePopupClick = (emoji: string) => {
    dispatch(
      updateReactListModal({
        reaction: emoji,
        messageId,
      })
    );
  };

  const closeReactionBar = () => {
    setTriggerPosition(null);
  };

  return (
    <StyledMessageContentContainer $isIncoming={isIncoming} $isDetailView={isDetailView}>
      <ExpirableReadableMessage
        messageId={messageId}
        className={clsx('module-message', `module-message--${direction}`)}
        role={'button'}
        onDoubleClickCapture={onDoubleClickReplyToMessage}
        dataTestId="message-content"
        contextMenuId={contextMenuId}
        setTriggerPosition={setTriggerPosition}
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
          <MessageStatus dataTestId="msg-status" messageId={messageId} />
        </Flex>
        {enableReactions ? (
          <SessionEmojiReactBarPopover
            messageId={messageId}
            open={!!triggerPosition}
            triggerPos={triggerPosition}
            onClickAwayFromReactionBar={closeReactionBar}
          />
        ) : null}
      </ExpirableReadableMessage>
      {!isDetailView && enableReactions && !!reactToMessage ? (
        <MessageReactions
          messageId={messageId}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onClick={reactToMessage}
          onPopupClick={handlePopupClick}
          noAvatar={hideAvatar}
        />
      ) : null}
    </StyledMessageContentContainer>
  );
};
