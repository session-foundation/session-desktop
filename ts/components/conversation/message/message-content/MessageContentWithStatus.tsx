import { SessionDataTestId, MouseEvent, useCallback, Dispatch } from 'react';
import { useSelector } from 'react-redux';
import { clsx } from 'clsx';
import styled from 'styled-components';
import { getAppDispatch } from '../../../../state/dispatch';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { MessageRenderingProps } from '../../../../models/messageType';
import { toggleSelectedMessageId } from '../../../../state/ducks/conversations';
import { updateReactListModal } from '../../../../state/ducks/modalDialog';
import { StateType } from '../../../../state/reducer';
import { useHideAvatarInMsgList, useMessageStatus } from '../../../../state/selectors';
import { getMessageContentWithStatusesSelectorProps } from '../../../../state/selectors/conversations';
import { Flex } from '../../../basic/Flex';
import { ExpirableReadableMessage } from '../message-item/ExpirableReadableMessage';
import { MessageAuthorText } from './MessageAuthorText';
import { MessageContent } from './MessageContent';
import { MessageContextMenu } from './MessageContextMenu';
import { MessageReactions } from './MessageReactions';
import { MessageStatus } from './MessageStatus';
import { useIsMessageSelectionMode } from '../../../../state/selectors/selectedConversation';
import { SessionEmojiReactBarPopover } from '../../SessionEmojiReactBarPopover';
import { PopoverTriggerPosition } from '../../../SessionTooltip';
import { trimWhitespace } from '../../../../session/utils/String';
import { useMessageReact, useMessageReply } from '../../../../hooks/useMessageInteractions';

export type MessageContentWithStatusSelectorProps = { isGroup: boolean } & Pick<
  MessageRenderingProps,
  'conversationType' | 'direction' | 'isDeleted'
>;

type Props = {
  messageId: string;
  ctxMenuID: string;
  dataTestId: SessionDataTestId;
  convoReactionsEnabled: boolean;
  triggerPosition: PopoverTriggerPosition | null;
  setTriggerPosition: Dispatch<PopoverTriggerPosition | null>;
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
  const {
    messageId,
    ctxMenuID,
    dataTestId,
    convoReactionsEnabled,
    triggerPosition,
    setTriggerPosition,
    autoFocusReactionBarFirstEmoji,
  } = props;
  const dispatch = getAppDispatch();
  const contentProps = useSelector((state: StateType) =>
    getMessageContentWithStatusesSelectorProps(state, messageId)
  );
  const reply = useMessageReply(messageId);
  const reactToMessage = useMessageReact(messageId);
  const hideAvatar = useHideAvatarInMsgList(messageId);
  const isDetailView = useIsDetailMessageView();
  const multiSelectMode = useIsMessageSelectionMode();
  const status = useMessageStatus(props.messageId);
  const isSent = status === 'sent' || status === 'read'; // a read message should be reactable

  const onClickOnMessageOuterContainer = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (multiSelectMode && messageId) {
        event.preventDefault();
        event.stopPropagation();
        dispatch(toggleSelectedMessageId(messageId));
      }
    },
    [dispatch, messageId, multiSelectMode]
  );

  const onDoubleClickReplyToMessage = reply
    ? (e: MouseEvent<HTMLDivElement>) => {
        const currentSelection = window.getSelection();
        const currentSelectionString = currentSelection?.toString() || undefined;

        if (
          (!currentSelectionString || trimWhitespace(currentSelectionString).length === 0) &&
          (e.target as any).localName !== 'em-emoji-picker'
        ) {
          e.preventDefault();
          void reply();
        }
      }
    : undefined;

  if (!contentProps) {
    return null;
  }

  const { direction: _direction, isDeleted } = contentProps;
  // NOTE we want messages on the left in the message detail view regardless of direction
  const direction = isDetailView ? 'incoming' : _direction;
  const isIncoming = direction === 'incoming';

  const enableReactions = convoReactionsEnabled && !isDeleted && (isSent || isIncoming);
  const enableContextMenu = !isDeleted;

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
        onClick={onClickOnMessageOuterContainer}
        onDoubleClickCapture={onDoubleClickReplyToMessage}
        dataTestId={dataTestId}
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
            autoFocusFirstEmoji={autoFocusReactionBarFirstEmoji}
          />
        ) : null}
        {enableContextMenu ? (
          <MessageContextMenu
            messageId={messageId}
            contextMenuId={ctxMenuID}
            setTriggerPosition={setTriggerPosition}
          />
        ) : null}
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
