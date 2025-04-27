import { isEmpty } from 'lodash';
import { useCallback, useLayoutEffect, useState } from 'react';
import clsx from 'clsx';

import { InView } from 'react-intersection-observer';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { useScrollToLoadedMessage } from '../../../../contexts/ScrollToLoadedMessage';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { IsMessageVisibleContext } from '../../../../contexts/isMessageVisibleContext';
import { MessageModelType, MessageRenderingProps } from '../../../../models/messageType';
import { StateType } from '../../../../state/reducer';
import {
  useHideAvatarInMsgList,
  useMessageIsDeleted,
  useMessageSelected,
} from '../../../../state/selectors';
import {
  getMessageContentSelectorProps,
  getQuotedMessageToAnimate,
  getShouldHighlightMessage,
} from '../../../../state/selectors/conversations';
import { useSelectedIsPrivate } from '../../../../state/selectors/selectedConversation';
import { MessageAttachment } from './MessageAttachment';
import { MessageAvatar } from './MessageAvatar';
import { MessageHighlighter } from './MessageHighlighter';
import { MessageLinkPreview } from './MessageLinkPreview';
import { MessageQuote } from './MessageQuote';
import { MessageText } from './MessageText';
import { useFormatFullDate } from '../../../../hooks/useFormatFullDate';

export type MessageContentSelectorProps = Pick<
  MessageRenderingProps,
  'text' | 'direction' | 'timestamp' | 'serverTimestamp' | 'previews' | 'quote' | 'attachments'
>;

type Props = {
  messageId: string;
};

const StyledMessageContent = styled.div<{ msgDirection: MessageModelType }>`
  display: flex;
  align-self: ${props => (props.msgDirection === 'incoming' ? 'flex-start' : 'flex-end')};
`;

const StyledMessageOpaqueContent = styled(MessageHighlighter)<{
  isIncoming: boolean;
  highlight: boolean;
  selected: boolean;
}>`
  background: ${props =>
    props.isIncoming
      ? 'var(--message-bubbles-received-background-color)'
      : 'var(--message-bubbles-sent-background-color)'};
  align-self: ${props => (props.isIncoming ? 'flex-start' : 'flex-end')};
  padding: var(--padding-message-content);
  border-radius: var(--border-radius-message-box);
  width: 100%;

  ${props => props.selected && `box-shadow: var(--drop-shadow);`}
`;

const StyledAvatarContainer = styled.div`
  align-self: flex-end;
`;

export const MessageContent = (props: Props) => {
  const isDetailView = useIsDetailMessageView();

  const [highlight, setHighlight] = useState(false);
  const [didScroll, setDidScroll] = useState(false);
  const contentProps = useSelector((state: StateType) =>
    getMessageContentSelectorProps(state, props.messageId)
  );
  const isDeleted = useMessageIsDeleted(props.messageId);
  const [isMessageVisible, setMessageIsVisible] = useState(false);

  const scrollToLoadedMessage = useScrollToLoadedMessage();
  const selectedIsPrivate = useSelectedIsPrivate();
  const hideAvatar = useHideAvatarInMsgList(props.messageId, isDetailView);

  const [imageBroken, setImageBroken] = useState(false);

  const onVisible = (inView: boolean, _: IntersectionObserverEntry) => {
    if (inView) {
      if (isMessageVisible !== true) {
        setMessageIsVisible(true);
      }
    }
  };

  const handleImageError = useCallback(() => {
    setImageBroken(true);
  }, [setImageBroken]);

  const quotedMessageToAnimate = useSelector(getQuotedMessageToAnimate);
  const shouldHighlightMessage = useSelector(getShouldHighlightMessage);
  const isQuotedMessageToAnimate = quotedMessageToAnimate === props.messageId;
  const selected = useMessageSelected(props.messageId);

  useLayoutEffect(() => {
    if (isQuotedMessageToAnimate) {
      if (!highlight && !didScroll) {
        // scroll to me and flash me
        scrollToLoadedMessage(props.messageId, 'quote-or-search-result');
        setDidScroll(true);
        if (shouldHighlightMessage) {
          setHighlight(true);
        }
      }
      return;
    }
    if (highlight) {
      setHighlight(false);
    }

    if (didScroll) {
      setDidScroll(false);
    }
  }, [
    isQuotedMessageToAnimate,
    highlight,
    didScroll,
    scrollToLoadedMessage,
    props.messageId,
    shouldHighlightMessage,
  ]);

  const toolTipTitle = useFormatFullDate(contentProps?.serverTimestamp || contentProps?.timestamp);

  if (!contentProps) {
    return null;
  }

  const { direction, text, previews, quote } = contentProps;

  const hasContentBeforeAttachment = !isEmpty(previews) || !isEmpty(quote) || !isEmpty(text);

  return (
    <StyledMessageContent
      className={clsx('module-message__container', `module-message__container--${direction}`)}
      role="button"
      title={toolTipTitle}
      msgDirection={direction}
    >
      {hideAvatar ? null : (
        <StyledAvatarContainer>
          <MessageAvatar messageId={props.messageId} isPrivate={selectedIsPrivate} />
        </StyledAvatarContainer>
      )}

      <InView
        id={`inview-content-${props.messageId}`}
        as={'div'}
        onChange={onVisible}
        threshold={0}
        rootMargin="500px 0px 500px 0px"
        triggerOnce={false}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--margins-xs)',
          maxWidth: '100%',
        }}
      >
        <IsMessageVisibleContext.Provider value={isMessageVisible}>
          {hasContentBeforeAttachment && (
            <StyledMessageOpaqueContent
              isIncoming={direction === 'incoming'}
              highlight={highlight}
              selected={selected}
            >
              {!isDeleted && (
                <>
                  <MessageQuote messageId={props.messageId} />
                  <MessageLinkPreview
                    messageId={props.messageId}
                    handleImageError={handleImageError}
                  />
                </>
              )}
              <MessageText messageId={props.messageId} />
            </StyledMessageOpaqueContent>
          )}
          {!isDeleted ? (
            <MessageAttachment
              messageId={props.messageId}
              imageBroken={imageBroken}
              handleImageError={handleImageError}
              highlight={highlight}
            />
          ) : null}
        </IsMessageVisibleContext.Provider>
      </InView>
    </StyledMessageContent>
  );
};
