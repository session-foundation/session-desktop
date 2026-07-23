import { assert } from 'chai';

import Sinon from 'sinon';
import { CONVERSATION_PRIORITIES, ConversationTypeEnum } from '../../../../models/types';
import type { ReplyingToMessageProps } from '../../../../components/conversation/composition/CompositionBox';
import {
  actions,
  ConversationLookupType,
  getEmptyConversationState,
  quoteMessage,
  reducer as conversationsReducer,
} from '../../../../state/ducks/conversations';
import type { StateType } from '../../../../state/reducer';
import {
  _getConversationComparator,
  _getSortedConversations,
  getQuotedMessage,
} from '../../../../state/selectors/conversations';
import { TestUtils } from '../../../test-utils';

describe('state/selectors/conversations', () => {
  beforeEach(() => {
    TestUtils.stubWindowLog();
    TestUtils.stubI18n();
  });
  afterEach(() => {
    Sinon.restore();
  });

  describe('#getQuotedMessage', () => {
    const openConversation = (
      state: ReturnType<typeof getEmptyConversationState>,
      conversationKey: string
    ) =>
      conversationsReducer(
        state,
        actions.openConversationExternal({
          conversationKey,
          initialMessages: [],
          initialQuotes: [],
          firstUnreadMessageId: null,
          mostRecentMessageId: null,
          oldestMessageId: null,
        })
      );

    const buildState = (conversations: ReturnType<typeof getEmptyConversationState>) =>
      ({ conversations }) as StateType;

    const firstQuote: ReplyingToMessageProps = {
      convoId: 'conversation-1',
      id: 'message-1',
      author: 'author-1',
      referencedMessageSentAt: 111,
      quotedAt: 1,
      text: 'first quote',
    };

    const secondQuote: ReplyingToMessageProps = {
      convoId: 'conversation-2',
      id: 'message-2',
      author: 'author-2',
      referencedMessageSentAt: 222,
      quotedAt: 2,
      text: 'second quote',
    };

    it('keeps draft reply quotes scoped to their conversation', () => {
      let state = getEmptyConversationState();

      state = openConversation(state, 'conversation-1');
      state = conversationsReducer(state, quoteMessage(firstQuote));
      assert.deepEqual(getQuotedMessage(buildState(state)), firstQuote);

      state = openConversation(state, 'conversation-2');
      assert.isUndefined(getQuotedMessage(buildState(state)));

      state = conversationsReducer(state, quoteMessage(secondQuote));
      assert.deepEqual(getQuotedMessage(buildState(state)), secondQuote);

      state = openConversation(state, 'conversation-1');
      assert.deepEqual(getQuotedMessage(buildState(state)), firstQuote);

      state = conversationsReducer(state, quoteMessage(undefined));
      assert.isUndefined(getQuotedMessage(buildState(state)));

      state = openConversation(state, 'conversation-2');
      assert.deepEqual(getQuotedMessage(buildState(state)), secondQuote);
    });
  });

  describe('#getSortedConversationsList', () => {
    it('sorts conversations based on timestamp then by intl-friendly title', () => {
      const data: ConversationLookupType = {
        id1: {
          id: 'id1',
          activeAt: 0,
          displayNameInProfile: 'No timestamp',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          isPublic: false,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,

          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          expireTimer: 0,
          priority: CONVERSATION_PRIORITIES.default,
        },
        id2: {
          id: 'id2',
          activeAt: 20,
          displayNameInProfile: 'B',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          isPublic: false,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,
          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          expireTimer: 0,
          priority: CONVERSATION_PRIORITIES.default,
        },
        id3: {
          id: 'id3',
          activeAt: 20,
          displayNameInProfile: 'C',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          isPublic: false,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,
          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          expireTimer: 0,
          priority: CONVERSATION_PRIORITIES.default,
        },
        id4: {
          id: 'id4',
          activeAt: 20,
          displayNameInProfile: 'Á',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          isPublic: false,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,
          avatarPath: '',
          groupAdmins: [],
          expireTimer: 0,
          lastMessage: undefined,
          members: [],
          priority: CONVERSATION_PRIORITIES.default,
        },
        id5: {
          id: 'id5',
          activeAt: 30,
          displayNameInProfile: 'First!',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          isPublic: false,
          expireTimer: 0,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,
          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          priority: CONVERSATION_PRIORITIES.default,
        },
      };
      const comparator = _getConversationComparator();
      const conversations = _getSortedConversations(data, comparator);

      assert.strictEqual(conversations[0].displayNameInProfile, 'First!');
      assert.strictEqual(conversations[1].displayNameInProfile, 'Á');
      assert.strictEqual(conversations[2].displayNameInProfile, 'B');
      assert.strictEqual(conversations[3].displayNameInProfile, 'C');
    });
  });

  describe('#getSortedConversationsWithPinned', () => {
    it('sorts conversations based on pin, timestamp then by intl-friendly title', () => {
      const data: ConversationLookupType = {
        id1: {
          id: 'id1',
          activeAt: 0,
          displayNameInProfile: 'No timestamp',

          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          expireTimer: 0,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,

          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          priority: CONVERSATION_PRIORITIES.default,
          isPublic: false,
        },
        id2: {
          id: 'id2',
          activeAt: 20,
          displayNameInProfile: 'B',

          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          expireTimer: 0,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,

          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],

          priority: CONVERSATION_PRIORITIES.default,
          isPublic: false,
        },
        id3: {
          id: 'id3',
          activeAt: 20,

          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          expireTimer: 0,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,
          displayNameInProfile: 'C',

          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          priority: CONVERSATION_PRIORITIES.pinned,
          isPublic: false,
        },
        id4: {
          id: 'id4',
          activeAt: 20,
          displayNameInProfile: 'Á',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,
          expireTimer: 0,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,

          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          priority: CONVERSATION_PRIORITIES.pinned,
          isPublic: false,
        },
        id5: {
          id: 'id5',
          activeAt: 30,
          displayNameInProfile: 'First!',
          type: ConversationTypeEnum.PRIVATE,
          isMe: false,
          unreadCount: 1,
          mentionedUs: false,
          isTyping: false,
          isBlocked: false,
          isKickedFromGroup: false,

          expireTimer: 0,
          currentNotificationSetting: 'all',
          weAreAdmin: false,
          isPrivate: false,

          avatarPath: '',
          groupAdmins: [],
          lastMessage: undefined,
          members: [],
          priority: CONVERSATION_PRIORITIES.default,
          isPublic: false,
        },
      };
      const comparator = _getConversationComparator();
      const conversations = _getSortedConversations(data, comparator);

      assert.strictEqual(conversations[0].displayNameInProfile, 'Á');
      assert.strictEqual(conversations[1].displayNameInProfile, 'C');
      assert.strictEqual(conversations[2].displayNameInProfile, 'First!');
      assert.strictEqual(conversations[3].displayNameInProfile, 'B');
    });
  });
});
