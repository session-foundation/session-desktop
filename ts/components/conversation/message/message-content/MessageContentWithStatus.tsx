import { type MouseEvent, useMemo } from 'react';
import { clsx } from 'clsx';
import styled from 'styled-components';
import { getAppDispatch } from '../../../../state/dispatch';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { MessageRenderingProps } from '../../../../models/messageType';
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
import { useMessageReact, useMessageReply } from '../../../../hooks/useMessageInteractions';
import {
  useSelectedConversationKey,
  useSelectedIsLegacyGroup,
} from '../../../../state/selectors/selectedConversation';
import { type WithPopoverPosition, type WithSetPopoverPosition } from '../../../SessionTooltip';
import { ConvoHub } from '../../../../session/conversations';
import type { WithContextMenuId, WithMessageId } from '../../../../session/types/with';

export type MessageContentWithStatusSelectorProps = { isGroup: boolean } & Pick<
  MessageRenderingProps,
  'conversationType' | 'direction' | 'isDeleted'
>;

type Props = WithMessageId &
  WithContextMenuId &
  WithPopoverPosition &
  WithSetPopoverPosition & {
    autoFocusReactionBarFirstEmoji?: boolean;
  };

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

export const MessageContentWithStatuses = (props: Props) => {
  const { messageId, contextMenuId, triggerPosition, setTriggerPosition } = props;
  const dispatch = getAppDispatch();
  const reactToMessage = useMessageReact(messageId);
  const reply = useMessageReply(messageId);
  const hideAvatar = useHideAvatarInMsgList(messageId);
  const isDetailView = useIsDetailMessageView();

  const _direction = useMessageDirection(messageId);
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
        triggerPosition={triggerPosition}
        enableReactions={enableReactions}
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
      </ExpirableReadableMessage>
      {!isDetailView && enableReactions ? (
        <MessageReactions
          messageId={messageId}
          onEmojiClick={reactToMessage ? emoji => void reactToMessage(emoji) : undefined}
          onPopupClick={handlePopupClick}
          noAvatar={hideAvatar}
        />
      ) : null}
    </StyledMessageContentContainer>
  );
};
