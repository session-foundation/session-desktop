import {
  type MouseEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useState,
  useRef,
} from 'react';
import clsx from 'clsx';

import { useSelector } from 'react-redux';
import styled, { keyframes } from 'styled-components';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { MessageRenderingProps } from '../../../../models/messageType';
import { ConvoHub } from '../../../../session/conversations';
import { StateType } from '../../../../state/reducer';
import { useMessageSelected } from '../../../../state/selectors';
import { getGenericReadableMessageSelectorProps } from '../../../../state/selectors/conversations';
import { MessageContentWithStatuses } from '../message-content/MessageContentWithStatus';
import { StyledMessageReactionsContainer } from '../message-content/MessageReactions';
import {
  useIsMessageSelectionMode,
  useSelectedIsBlocked,
} from '../../../../state/selectors/selectedConversation';
import { isButtonClickKey } from '../../../../util/keyboardShortcuts';
import { showMessageContextMenu } from '../message-content/MessageContextMenu';

export type GenericReadableMessageSelectorProps = Pick<
  MessageRenderingProps,
  | 'direction'
  | 'conversationType'
  | 'receivedAt'
  | 'isUnread'
  | 'convoId'
  | 'isDeleted'
  | 'isKickedFromGroup'
>;

type Props = {
  messageId: string;
  ctxMenuID: string;
};

const highlightedMessageAnimation = keyframes`
  1% { background-color: var(--primary-color); }
`;

const StyledReadableMessage = styled.div<{
  selected: boolean;
  $isDetailView: boolean;
}>`
  display: flex;
  align-items: center;
  width: 100%;
  letter-spacing: 0.03rem;
  padding: ${props => (props.$isDetailView ? '0' : 'var(--margins-xs) var(--margins-lg) 0')};

  &.message-highlighted {
    animation: ${highlightedMessageAnimation} var(--duration-message-highlight) ease-in-out;
  }

  ${StyledMessageReactionsContainer} {
    margin-top: var(--margins-xs);
  }

  &:focus {
    background-color: var(--conversation-tab-background-selected-color);
  }
`;

export const GenericReadableMessage = (props: Props) => {
  const isDetailView = useIsDetailMessageView();

  const { ctxMenuID, messageId } = props;

  const [enableReactions, setEnableReactions] = useState(true);

  const msgProps = useSelector((state: StateType) =>
    getGenericReadableMessageSelectorProps(state, props.messageId)
  );

  const isMessageSelected = useMessageSelected(props.messageId);
  const selectedIsBlocked = useSelectedIsBlocked();

  const multiSelectMode = useIsMessageSelectionMode();

  const ref = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback(
    (
      e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
      triggerPosition?: { x: number; y: number }
    ) => {
      if (!selectedIsBlocked && !multiSelectMode && !msgProps?.isKickedFromGroup) {
        showMessageContextMenu({
          id: ctxMenuID,
          event: e,
          triggerPosition,
        });
      }
    },
    [selectedIsBlocked, ctxMenuID, multiSelectMode, msgProps?.isKickedFromGroup]
  );

  const onContextMenu = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      return handleContextMenu(e);
    },
    [handleContextMenu]
  );

  useEffect(() => {
    if (msgProps?.convoId) {
      const conversationModel = ConvoHub.use().get(msgProps?.convoId);
      if (conversationModel) {
        setEnableReactions(conversationModel.hasReactions());
      }
    }
  }, [msgProps?.convoId]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (isButtonClickKey(e) && ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const parent = ref.current.parentElement?.getBoundingClientRect();

        handleContextMenu(e, {
          x: rect.right,
          // NOTE: y needs to be clamped to the parent otherwise it can overflow the container
          y: Math.max(rect.top, parent?.top ?? 0),
        });
      }
    },
    [handleContextMenu]
  );

  if (!msgProps) {
    return null;
  }

  const selected = isMessageSelected || false;

  return (
    <StyledReadableMessage
      ref={ref}
      selected={selected}
      $isDetailView={isDetailView}
      className={clsx(selected ? 'message-selected' : undefined)}
      onContextMenu={onContextMenu}
      key={`readable-message-${messageId}`}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <MessageContentWithStatuses
        ctxMenuID={ctxMenuID}
        messageId={messageId}
        dataTestId={'message-content'}
        enableReactions={enableReactions}
      />
    </StyledReadableMessage>
  );
};
