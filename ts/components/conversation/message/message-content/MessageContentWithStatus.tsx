import { SessionDataTestId, MouseEvent, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { clsx } from 'clsx';
import styled from 'styled-components';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { replyToMessage } from '../../../../interactions/conversationInteractions';
import { MessageRenderingProps } from '../../../../models/messageType';
import { toggleSelectedMessageId } from '../../../../state/ducks/conversations';
import { updateReactListModal } from '../../../../state/ducks/modalDialog';
import { StateType } from '../../../../state/reducer';
import { useHideAvatarInMsgList } from '../../../../state/selectors';
import { getMessageContentWithStatusesSelectorProps } from '../../../../state/selectors/conversations';
import { Reactions } from '../../../../util/reactions';
import { Flex } from '../../../basic/Flex';
import { ExpirableReadableMessage } from '../message-item/ExpirableReadableMessage';
import { MessageAuthorText } from './MessageAuthorText';
import { MessageContent } from './MessageContent';
import { MessageContextMenu } from './MessageContextMenu';
import { MessageReactions } from './MessageReactions';
import { MessageStatus } from './MessageStatus';
import {
  useIsMessageSelectionMode,
  useSelectedIsLegacyGroup,
} from '../../../../state/selectors/selectedConversation';

export type MessageContentWithStatusSelectorProps = { isGroup: boolean } & Pick<
  MessageRenderingProps,
  'conversationType' | 'direction' | 'isDeleted'
>;

type Props = {
  messageId: string;
  ctxMenuID: string;
  dataTestId: SessionDataTestId;
  enableReactions: boolean;
};

const StyledMessageContentContainer = styled.div<{ isIncoming: boolean; isDetailView: boolean }>`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: ${props => (props.isIncoming ? 'flex-start' : 'flex-end')};
  padding-left: ${props => (props.isDetailView || props.isIncoming ? 0 : '25%')};
  padding-right: ${props => (props.isDetailView || !props.isIncoming ? 0 : '25%')};
  width: 100%;
  max-width: '100%';
`;

const StyledMessageWithAuthor = styled.div`
  max-width: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: var(--margins-xs);
`;

export const MessageContentWithStatuses = (props: Props) => {
  const isDetailView = useIsDetailMessageView();

  const contentProps = useSelector((state: StateType) =>
    getMessageContentWithStatusesSelectorProps(state, props.messageId)
  );
  const dispatch = useDispatch();
  const hideAvatar = useHideAvatarInMsgList(props.messageId);

  const multiSelectMode = useIsMessageSelectionMode();
  const isLegacyGroup = useSelectedIsLegacyGroup();

  const onClickOnMessageOuterContainer = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (multiSelectMode && props?.messageId) {
        event.preventDefault();
        event.stopPropagation();
        dispatch(toggleSelectedMessageId(props?.messageId));
      }
    },
    [dispatch, props?.messageId, multiSelectMode]
  );

  const onDoubleClickReplyToMessage = (e: MouseEvent<HTMLDivElement>) => {
    if (isLegacyGroup) {
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
        void replyToMessage(messageId);
        currentSelection?.empty();
        e.preventDefault();
      }
    }
  };

  const { messageId, ctxMenuID, dataTestId, enableReactions } = props;

  if (!contentProps) {
    return null;
  }

  const { direction: _direction, isDeleted } = contentProps;
  // NOTE we want messages on the left in the message detail view regardless of direction
  const direction = isDetailView ? 'incoming' : _direction;
  const isIncoming = direction === 'incoming';

  const handleMessageReaction = async (emoji: string) => {
    await Reactions.sendMessageReaction(messageId, emoji);
  };

  const handlePopupClick = (emoji: string) => {
    dispatch(
      updateReactListModal({
        reaction: emoji,
        messageId,
      })
    );
  };

  return (
    <StyledMessageContentContainer isIncoming={isIncoming} isDetailView={isDetailView}>
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
          maxWidth="100%"
        >
          <StyledMessageWithAuthor>
            {!isDetailView && <MessageAuthorText messageId={messageId} />}
            <MessageContent messageId={messageId} />
          </StyledMessageWithAuthor>
          <MessageStatus dataTestId="msg-status" messageId={messageId} />
        </Flex>
        {!isDeleted && (
          <MessageContextMenu
            messageId={messageId}
            contextMenuId={ctxMenuID}
            enableReactions={enableReactions}
          />
        )}
      </ExpirableReadableMessage>
      {!isDetailView && enableReactions ? (
        <MessageReactions
          messageId={messageId}
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onClick={handleMessageReaction}
          onPopupClick={handlePopupClick}
          noAvatar={hideAvatar}
        />
      ) : null}
    </StyledMessageContentContainer>
  );
};
