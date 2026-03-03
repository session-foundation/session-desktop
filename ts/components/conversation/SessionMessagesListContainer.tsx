import { connect } from 'react-redux';

import autoBind from 'auto-bind';
import { Component, RefObject } from 'react';
import {
  ReduxConversationType,
  SortedMessageModelProps,
  quotedMessageToAnimate,
  resetOldBottomMessageId,
  resetOldTopMessageId,
} from '../../state/ducks/conversations';

import { ScrollToLoadedReasons } from '../../contexts/ScrollToLoadedMessage';
import { StateType } from '../../state/reducer';
import {
  getQuotedMessageToAnimate,
  getSelectedConversation,
  getSortedMessagesOfSelectedConversation,
} from '../../state/selectors/conversations';
import { getSelectedConversationKey } from '../../state/selectors/selectedConversation';
import { messageContainerDomID, SessionMessagesList } from './SessionMessagesList';
import { closeContextMenus } from '../../util/contextMenu';

export type SessionMessageListProps = {
  messageContainerRef: RefObject<HTMLDivElement | null>;
};

type Props = SessionMessageListProps & {
  conversationKey?: string;
  messagesProps: Array<SortedMessageModelProps>;

  conversation?: ReduxConversationType;
  animateQuotedMessageId: string | undefined;
  scrollToNow: () => Promise<unknown>;
};

class SessionMessagesListContainerInner extends Component<Props> {
  private timeoutResetQuotedScroll: NodeJS.Timeout | null = null;

  public constructor(props: Props) {
    super(props);
    autoBind(this);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~ LIFECYCLES ~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  public componentWillUnmount() {
    if (this.timeoutResetQuotedScroll) {
      global.clearTimeout(this.timeoutResetQuotedScroll);
    }
  }

  public componentDidUpdate(prevProps: Props, _prevState: any) {
    const isSameConvo = prevProps.conversationKey === this.props.conversationKey;

    if (
      !isSameConvo &&
      this.props.messagesProps.length &&
      this.props.messagesProps[0].propsForMessage.convoId === this.props.conversationKey
    ) {
      this.setupTimeoutResetQuotedHighlightedMessage(this.props.animateQuotedMessageId);
      // displayed conversation changed. We have a bit of cleaning to do here
    }
  }

  public render() {
    const { conversationKey, conversation } = this.props;

    if (!conversationKey || !conversation) {
      return null;
    }

    return (
      <SessionMessagesList
        conversation={conversation}
        handleScroll={this.handleScroll}
        messageContainerRef={this.props.messageContainerRef}
        onPageDownPressed={this.scrollPgDown}
        onPageUpPressed={this.scrollPgUp}
        onHomePressed={this.scrollTop}
        onEndPressed={this.scrollEnd}
        scrollToLoadedMessage={this.scrollToLoadedMessage}
        scrollToMessage={this.scrollToMessage}
        scrollToNow={this.props.scrollToNow}
      />
    );
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~ SCROLLING METHODS ~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  private handleScroll() {
    closeContextMenus();
  }

  /**
   * Could not find a better name, but when we click on a quoted message,
   * the UI takes us there and highlights it.
   * If the user clicks again on this message, we want this highlight to be
   * shown once again.
   *
   * So we need to reset the state of of the highlighted message so when the users clicks again,
   * the highlight is shown once again
   */
  private setupTimeoutResetQuotedHighlightedMessage(messageId: string | undefined) {
    if (this.timeoutResetQuotedScroll) {
      global.clearTimeout(this.timeoutResetQuotedScroll);
    }

    if (messageId !== undefined) {
      this.timeoutResetQuotedScroll = global.setTimeout(() => {
        window.inboxStore?.dispatch(quotedMessageToAnimate(undefined));
      }, 1000); // should match StyledMessageOpaqueContent
    }
  }

  private scrollToMessage(messageId: string, reason: ScrollToLoadedReasons) {
    const messageElementDom = document.getElementById(`msg-${messageId}`);
    // annoyingly, useLayoutEffect, which is calling this function, is run before ref are set on a react component.
    // so the only way to scroll in the container at this time, is with the DOM itself
    const messageContainerDom = document.getElementById(messageContainerDomID);

    // * if quote or search result we want to scroll to start AND do a -50px
    // * if scroll-to-unread we want to scroll end AND do a +200px to be really at the end
    // * if load-more-top or bottom we want to center

    switch (reason) {
      case 'load-more-bottom':
        messageElementDom?.scrollIntoView({
          behavior: 'auto',
          block: 'end',
        });
        // reset the oldBottomInRedux so that a refresh/new message does not scroll us back here again
        window.inboxStore?.dispatch(resetOldBottomMessageId());
        break;
      case 'load-more-top':
        messageElementDom?.scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
        // reset the oldTopInRedux so that a refresh/new message does not scroll us back here again
        window.inboxStore?.dispatch(resetOldTopMessageId());
        break;
      case 'quote-or-search-result':
        messageElementDom?.scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
        messageContainerDom?.scrollBy({ top: -50 });

        break;
      case 'go-to-bottom':
        messageElementDom?.scrollIntoView({
          behavior: 'auto',
          block: 'end',
        });
        messageContainerDom?.scrollBy({ top: 200 });

        break;
      case 'unread-indicator':
        messageElementDom?.scrollIntoView({
          behavior: 'auto',
          block: 'center',
        });
        messageContainerDom?.scrollBy({ top: -50 });
        break;
      default:
    }
  }

  private scrollPgUp() {
    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }
    messageContainer.scrollBy({
      top: Math.floor(-messageContainer.clientHeight * 2) / 3,
      behavior: 'smooth',
    });
  }

  private scrollPgDown() {
    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }

    messageContainer.scrollBy({
      top: Math.floor(+messageContainer.clientHeight * 2) / 3,
      behavior: 'smooth',
    });
  }

  private scrollTop() {
    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }

    messageContainer.scrollTo(0, -messageContainer.scrollHeight);
  }

  private scrollEnd() {
    const messageContainer = this.props.messageContainerRef.current;
    if (!messageContainer) {
      return;
    }

    messageContainer.scrollTo(0, messageContainer.scrollHeight);
  }

  private scrollToLoadedMessage(loadedMessageToScrollTo: string, reason: ScrollToLoadedReasons) {
    if (!this.props.conversationKey || !loadedMessageToScrollTo) {
      return;
    }

    const { messagesProps } = this.props;

    // If there's no message already in memory, we won't be scrolling. So we'll gather
    //   some more information then show an informative toast to the user.
    if (!messagesProps.find(m => m.propsForMessage.id === loadedMessageToScrollTo)) {
      throw new Error('this message is not loaded');
    }

    this.scrollToMessage(loadedMessageToScrollTo, reason);
    // Highlight this message on the UI
    if (reason === 'quote-or-search-result') {
      window.inboxStore?.dispatch(quotedMessageToAnimate(loadedMessageToScrollTo));
      this.setupTimeoutResetQuotedHighlightedMessage(loadedMessageToScrollTo);
    }
  }
}

const mapStateToProps = (state: StateType) => {
  return {
    conversationKey: getSelectedConversationKey(state),
    conversation: getSelectedConversation(state),
    messagesProps: getSortedMessagesOfSelectedConversation(state),
    animateQuotedMessageId: getQuotedMessageToAnimate(state),
  };
};

const smart = connect(mapStateToProps);

export const SessionMessagesListContainer = smart(SessionMessagesListContainerInner);
