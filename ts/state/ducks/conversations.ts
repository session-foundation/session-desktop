/* eslint-disable no-restricted-syntax */
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PubkeyType } from 'libsession_util_nodejs';
import { omit } from 'lodash';
import { ReplyingToMessageProps } from '../../components/conversation/composition/CompositionBox';
import { Data } from '../../data/data';

import { ConversationNotificationSettingType } from '../../models/conversationAttributes';
import { MessageModelType, PropsForDataExtractionNotification } from '../../models/messageType';
import { ConvoHub } from '../../session/conversations';
import { DisappearingMessages } from '../../session/disappearing_messages';
import {
  DisappearingMessageConversationModeType,
  DisappearingMessageType,
} from '../../session/disappearing_messages/types';
import { ReactionList } from '../../types/Reaction';
import {
  LastMessageStatusType,
  LastMessageType,
  PropsForCallNotification,
  PropsForInteractionNotification,
  type FetchMessageSharedResult,
  type PropsForMessageRequestResponse,
} from './types';
import { AttachmentType } from '../../types/Attachment';
import { CONVERSATION_PRIORITIES, ConversationTypeEnum } from '../../models/types';
import { WithConvoId, WithMessageHash, WithMessageId } from '../../session/types/with';
import { cancelUpdatesToDispatch } from '../../models/message';
import type { SessionSuggestionDataItem } from '../../components/conversation/composition/types';
import { Storage } from '../../util/storage';
import { SettingsKey } from '../../data/settings-key';
import { sectionActions } from './section';
import { ed25519Str } from '../../session/utils/String';
import { UserUtils } from '../../session/utils';
import type { ProMessageFeature } from '../../models/proMessageFeature';
import { handleTriggeredCTAs } from '../../components/dialog/SessionCTA';
import { getFeatureFlag } from './types/releasedFeaturesReduxTypes';
import type { Quote } from '../../session/messages/outgoing/visibleMessage/VisibleMessage';

export type MessageModelPropsWithoutConvoProps = {
  propsForMessage: PropsForMessageWithoutConvoProps;
  propsForCommunityInvitation?: PropsForCommunityInvitation;
  propsForTimerNotification?: PropsForExpirationTimer;
  propsForDataExtractionNotification?: PropsForDataExtractionNotification;
  propsForGroupUpdateMessage?: PropsForGroupUpdate;
  propsForCallNotification?: PropsForCallNotification;
  propsForMessageRequestResponse?: PropsForMessageRequestResponse;
  propsForInteractionNotification?: PropsForInteractionNotification;
};

export type MessageModelPropsWithConvoProps = SortedMessageModelProps & {
  propsForMessage: PropsForMessageWithConvoProps;
};

export type ContactPropsMessageDetail = {
  status: string | undefined;
  pubkey: string;
  name?: string | null;
  profileName?: string | null;
  avatarPath?: string | null;
  errors?: Array<Error>;
};

export type FindAndFormatContactType = {
  pubkey: string;
  avatarPath: string | null;
  name: string | null;
  profileName: string | null;
  isMe: boolean;
};

export type PropsForExpiringMessage = {
  convoId?: string;
  messageId: string;
  direction: MessageModelType;
  receivedAt?: number;
  isUnread?: boolean;
  expirationTimestamp?: number | null;
  expirationDurationMs?: number | null;
  isExpired?: boolean;
};

export type PropsForExpirationTimer = {
  expirationMode: DisappearingMessageConversationModeType;
  timespanText: string;
  timespanSeconds: number | null;
};

export type PropsForGroupUpdateAdd = {
  type: 'add';
  withHistory: boolean;
  added: Array<PubkeyType>;
};

export type PropsForGroupUpdateKicked = {
  type: 'kicked';
  kicked: Array<PubkeyType>;
};

export type PropsForGroupUpdatePromoted = {
  type: 'promoted';
  promoted: Array<PubkeyType>;
};

export type PropsForGroupUpdateAvatarChange = {
  type: 'avatarChange';
};

export type PropsForGroupUpdateLeft = {
  type: 'left';
  left: Array<PubkeyType>;
};

export type PropsForGroupUpdateName = {
  type: 'name';
  newName: string;
};

export type PropsForGroupUpdateType =
  | PropsForGroupUpdateAdd
  | PropsForGroupUpdateKicked
  | PropsForGroupUpdatePromoted
  | PropsForGroupUpdateAvatarChange
  | PropsForGroupUpdateName
  | PropsForGroupUpdateLeft;

export type PropsForGroupUpdate = {
  change: PropsForGroupUpdateType;
};

export type PropsForCommunityInvitation = {
  serverName: string;
  fullUrl: string;
};

export type PropsForAttachment = AttachmentType & {
  isVoiceMessage: boolean;
  size: number;
  path: string;
  pending: boolean;
  error?: number; // if the download somehow failed, this will be set to true and be 0 or 1 in the db
};

export type PropsForMessageWithoutConvoProps = {
  id: string; // messageId
  direction: MessageModelType;
  timestamp: number;
  sender: string; // this is the sender/author
  convoId: string; // this is the conversation in which this message was sent
  text?: string;
  receivedAt?: number;
  serverTimestamp?: number;
  serverId?: number;
  status?: LastMessageStatusType;
  attachments?: Array<PropsForAttachment>;
  reacts?: ReactionList;
  reactsIndex?: number;
  previews?: Array<any>;
  quote?: Quote;
  messageHash?: string;
  isDeleted?: boolean;
  isUnread?: boolean;
  expirationType?: DisappearingMessageType;
  expirationDurationMs?: number;
  expirationTimestamp?: number | null;
  isExpired?: boolean;
  /**
   * true if the sender of that message is trusted for auto attachment downloads.
   * Note: we keep it in the PropsForMessageWithoutConvoProps because it is a per-sender setting
   * rather than a per-convo setting (especially for groups)
   */
  isTrustedForAttachmentDownload?: boolean;

  proFeaturesUsed?: Array<ProMessageFeature>;
};

export type PropsForMessageWithConvoProps = PropsForMessageWithoutConvoProps & {
  conversationType: ConversationTypeEnum;
  isPublic: boolean;
  isKickedFromGroup: boolean;
  weAreAdmin: boolean;
  isSenderAdmin: boolean;
  isDeletable: boolean;
  isDeletableForEveryone: boolean;
  isBlocked: boolean;
  isDeleted?: boolean;
};

/**
 * This closely matches ConversationAttributes except making a lot of fields optional.
 * The size of the redux store is an issue considering the number of conversations we have, so having optional fields here
 * allows us to not have them set if they have their default values.
 */
export interface ReduxConversationType {
  id: string;
  /**
   * This must hold the real session username of the user for a private chat (not the nickname), and the real name of the group/closed group otherwise
   */
  displayNameInProfile?: string;
  nickname?: string;

  activeAt?: number;
  lastMessage?: LastMessageType;
  type: ConversationTypeEnum;
  isMe?: boolean;
  isPublic?: boolean;
  isPrivate?: boolean; // !isPrivate means isGroup (group or community)
  weAreAdmin?: boolean;
  unreadCount?: number;
  mentionedUs?: boolean;
  expirationMode?: DisappearingMessageConversationModeType;
  expireTimer?: number;
  isExpired03Group?: boolean;
  isTyping?: boolean;
  isBlocked?: boolean;
  isKickedFromGroup?: boolean;
  /**
   * Absolute path to the avatar to display for that user.
   * Note:
   *  - if the corresponding user is a pro user, his (potentially) animated avatar will be set in this `avatarPath` field.
   *  - if the corresponding user is not a pro user, his fallback avatar path will be set in this `avatarPath` field.
   */
  avatarPath?: string | null;
  groupAdmins?: Array<string>; // admins for closed groups and admins for open groups
  members?: Array<string>; // members for closed groups only

  /**
   * If this is undefined, it means all notification are enabled
   */
  currentNotificationSetting?: ConversationNotificationSettingType;
  /**
   * @see {@link ConversationAttributes#conversationIdOrigin}.
   */
  conversationIdOrigin?: string;

  priority?: number; // undefined means 0
  isInitialFetchingInProgress?: boolean;
  isApproved?: boolean;
  didApproveMe?: boolean;

  isMarkedUnread?: boolean;

  blocksSogsMsgReqsTimestamp?: number; // undefined means 0
  /**
   * Only used for the other users and not ourselves
   */
  showProBadgeOthers?: boolean;
}

export interface NotificationForConvoOption {
  name: string;
  value: ConversationNotificationSettingType;
}

export type ConversationLookupType = {
  [key: string]: ReduxConversationType;
};

export type ConversationsStateType = {
  conversationLookup: ConversationLookupType;
  selectedConversation?: string;
  // NOTE the messages that are in view
  messages: Array<MessageModelPropsWithoutConvoProps>;
  // NOTE the messages quoted by other messages which are in view
  quotedMessages: Array<MessageModelPropsWithoutConvoProps>;
  firstUnreadMessageId: string | null;
  messageInfoId: string | undefined;
  showRightPanel: boolean;
  selectedMessageIds: Array<string>;
  quotedMessage?: ReplyingToMessageProps;
  areMoreMessagesBeingFetched: boolean;

  /**
   * oldTopMessageId should only be set when, as the user scroll up we trigger a load of more top messages.
   * Saving it here, make it possible to restore the position of the user before the refresh by pointing
   * at that same messageId and aligning the list to the top.
   *
   * Once the view scrolled, this value is reset by resetOldTopMessageId
   */

  oldTopMessageId: string | null;
  /**
   * oldBottomMessageId should only be set when, as the user scroll down we trigger a load of more bottom messages.
   * Saving it here, make it possible to restore the position of the user before the refresh by pointing
   * at that same messageId and aligning the list to the bottom.
   *
   * Once the view scrolled, this value is reset by resetOldBottomMessageId
   */
  oldBottomMessageId: string | null;

  /**
   * Contains the most recent message id for this conversation.
   * This is the one at the bottom, if the most recent page of the conversation was loaded.
   * But this might also be a message not visible (like if the user scrolled up, the most recent message is not rendered)
   */
  mostRecentMessageId: string | null;

  showScrollButton: boolean;
  animateQuotedMessageId?: string;
  shouldHighlightMessage: boolean;
  nextMessageToPlayId?: string;
  mentionMembers: Array<SessionSuggestionDataItem>;
};

export function lookupQuoteInStore({
  timestamp,
  quotedMessagesInStore,
}: {
  timestamp: number;
  quotedMessagesInStore: Array<MessageModelPropsWithoutConvoProps>;
}) {
  const foundAt = quotedMessagesInStore.findIndex(m => m.propsForMessage.timestamp === timestamp);

  return {
    foundAt,
    foundProps: quotedMessagesInStore[foundAt],
  };
}

/**
 * Fetches the messages for a conversation to put into redux.
 * @param conversationKey - the id of the conversation
 * @param messageId - the id of the message in view so we can fetch the messages around it
 * @returns the fetched models for messages and quoted messages
 */
async function getMessages({
  conversationKey,
  messageId,
}: {
  conversationKey: string;
  messageId: string | null;
}): Promise<
  FetchMessageSharedResult & {
    messagesProps: Array<MessageModelPropsWithoutConvoProps>;
    quotedMessagesProps: Array<MessageModelPropsWithoutConvoProps>;
  }
> {
  const beforeTimestamp = Date.now();

  const conversation = ConvoHub.use().get(conversationKey);
  if (!conversation) {
    // no valid conversation, early return
    window?.log?.error('Failed to get convo on reducer.');
    return {
      messagesProps: [],
      quotedMessagesProps: [],
      firstUnreadMessageId: null,
      mostRecentMessageId: null,
      oldestMessageId: null,
    };
  }

  const { messages, quotedMessages, firstUnreadMessageId, mostRecentMessageId, oldestMessageId } =
    await Data.getMessagesByConversation(conversationKey, {
      messageId,
      returnQuotes: true,
    });

  const messagesProps: Array<MessageModelPropsWithoutConvoProps> = messages.map(m => {
    return m.getMessageModelProps();
  });

  const quotedMessagesProps: Array<MessageModelPropsWithoutConvoProps> = (quotedMessages ?? [])
    .map(m => {
      return m.getMessageModelProps();
    })
    .filter(m => {
      if (m.propsForMessage.timestamp && m.propsForMessage.sender) {
        return true;
      }
      return false;
    });
  window?.log?.info(
    `Loading ${messagesProps.length} messages (${quotedMessagesProps.length} quoted messages) took ${Date.now() - beforeTimestamp}ms to load for convo ${ed25519Str(conversationKey)}.`
  );

  return {
    messagesProps,
    quotedMessagesProps,
    firstUnreadMessageId,
    mostRecentMessageId,
    oldestMessageId,
  };
}

export type SortedMessageModelProps = MessageModelPropsWithoutConvoProps & {
  firstMessageOfSeries: boolean;
  lastMessageOfSeries: boolean;
};

type FetchedTopMessageResults = {
  conversationKey: string;
  messagesProps: Array<MessageModelPropsWithoutConvoProps>;
  quotedMessagesProps: Array<MessageModelPropsWithoutConvoProps>;
  oldTopMessageId: string | null;
  newMostRecentMessageIdInConversation: string | null;
} | null;

export const fetchTopMessagesForConversation = createAsyncThunk(
  'messages/fetchTopByConversationKey',
  async ({
    conversationKey,
    oldTopMessageId,
  }: {
    conversationKey: string;
    oldTopMessageId: string | null;
  }): Promise<FetchedTopMessageResults> => {
    // no need to load more top if we are already at the top
    const oldestMessageId = await Data.getOldestMessageIdInConversation(conversationKey);
    const mostRecentMessage = await Data.getLastMessageInConversation(conversationKey);

    if (!oldestMessageId || oldestMessageId === oldTopMessageId) {
      window.log.debug('fetchTopMessagesForConversation: we are already at the top');
      return null;
    }
    const { messagesProps, quotedMessagesProps } = await getMessages({
      conversationKey,
      messageId: oldTopMessageId,
    });

    return {
      conversationKey,
      messagesProps,
      quotedMessagesProps,
      oldTopMessageId,
      newMostRecentMessageIdInConversation: mostRecentMessage?.id || null,
    };
  }
);

type FetchedBottomMessageResults = {
  conversationKey: string;
  messagesProps: Array<MessageModelPropsWithoutConvoProps>;
  quotedMessagesProps: Array<MessageModelPropsWithoutConvoProps>;
  oldBottomMessageId: string | null;
  newMostRecentMessageIdInConversation: string | null;
} | null;

export const fetchBottomMessagesForConversation = createAsyncThunk(
  'messages/fetchBottomByConversationKey',
  async ({
    conversationKey,
    oldBottomMessageId,
  }: {
    conversationKey: string;
    oldBottomMessageId: string | null;
  }): Promise<FetchedBottomMessageResults> => {
    // no need to load more bottom if we are already at the bottom
    const mostRecentMessage = await Data.getLastMessageInConversation(conversationKey);

    if (!mostRecentMessage || mostRecentMessage.id === oldBottomMessageId) {
      // window.log.debug('fetchBottomMessagesForConversation: we are already at the bottom');
      return null;
    }
    const { messagesProps, quotedMessagesProps } = await getMessages({
      conversationKey,
      messageId: oldBottomMessageId,
    });

    return {
      conversationKey,
      messagesProps,
      quotedMessagesProps,
      oldBottomMessageId,
      newMostRecentMessageIdInConversation: mostRecentMessage.id,
    };
  }
);

// Reducer

export function getEmptyConversationState(): ConversationsStateType {
  return {
    conversationLookup: {},
    messages: [],
    quotedMessages: [],
    messageInfoId: undefined,
    showRightPanel: false,
    selectedMessageIds: [],
    areMoreMessagesBeingFetched: false, // top or bottom
    showScrollButton: false,
    mentionMembers: [],
    firstUnreadMessageId: null,
    oldTopMessageId: null,
    oldBottomMessageId: null,
    shouldHighlightMessage: false,
    mostRecentMessageId: null,
  };
}

function handleMessageChangedOrAdded(
  state: ConversationsStateType,
  changedOrAddedMessageProps: MessageModelPropsWithoutConvoProps
) {
  if (changedOrAddedMessageProps.propsForMessage.convoId !== state.selectedConversation) {
    return state;
  }

  const messageInStoreIndex = state.messages.findIndex(
    m => m.propsForMessage.id === changedOrAddedMessageProps.propsForMessage.id
  );
  if (messageInStoreIndex >= 0) {
    state.messages[messageInStoreIndex] = changedOrAddedMessageProps;
    state.mostRecentMessageId = updateMostRecentMessageId(state);

    return state;
  }

  // this message was not present before in the state, and we assume it was added at the bottom.
  // as showScrollButton is set, it means we are not scrolled down, hence, that message is not visible
  // this is to avoid adding messages at the bottom when we are scrolled up looking at old messages. The new message which just came in is not going to at his right place by adding it at the end here.
  if (state.showScrollButton) {
    return state;
  }

  // sorting happens in the selector
  state.messages.push(changedOrAddedMessageProps);
  state.mostRecentMessageId = updateMostRecentMessageId(state);
  return state;
}

function updateMostRecentMessageId(state: ConversationsStateType) {
  // update the most recent message id as this is the one used to display the last MessageStatus
  let foundSoFarMaxId = '';
  let foundSoFarMaxTimestamp = 0;

  state.messages.forEach(m => {
    if (
      (m.propsForMessage.serverTimestamp || m.propsForMessage.timestamp || 0) >
      foundSoFarMaxTimestamp
    ) {
      foundSoFarMaxId = m.propsForMessage.id;
      foundSoFarMaxTimestamp = m.propsForMessage.serverTimestamp || m.propsForMessage.timestamp;
    }
  });
  return foundSoFarMaxId;
}

function handleMessagesChangedOrAdded(
  state: ConversationsStateType,
  payload: Array<MessageModelPropsWithoutConvoProps>
) {
  let stateCopy = state;
  payload.forEach(element => {
    stateCopy = handleMessageChangedOrAdded(stateCopy, element);
  });

  return stateCopy;
}

function handleMessageExpiredOrDeleted(
  state: ConversationsStateType,
  payload: WithConvoId & (WithMessageId | WithMessageHash)
) {
  const { conversationId } = payload;
  const messageId = (payload as any).messageId as string | undefined;
  const messageHash = (payload as any).messageHash as string | undefined;

  if (messageId) {
    cancelUpdatesToDispatch([messageId]);
  }

  if (conversationId === state.selectedConversation) {
    // search if we find this message id.
    // we might have not loaded yet, so this case might not happen
    const messageInStoreIndex = state?.messages.findIndex(
      m =>
        (messageId && m.propsForMessage.id === messageId) ||
        (messageHash && m.propsForMessage.messageHash === messageHash)
    );
    if (messageInStoreIndex >= 0) {
      const msgToRemove = state.messages[messageInStoreIndex];
      const extractedMessageId = msgToRemove.propsForMessage.id;
      const msgRemovedProps = state.messages[messageInStoreIndex].propsForMessage;

      // we cannot edit the array directly, so slice the first part, and slice the second part,
      // keeping the index removed out
      const editedMessages = [...state.messages];
      editedMessages.splice(messageInStoreIndex, 1);
      const editedQuotedMessages = [...state.quotedMessages];

      // Check if the message is quoted somewhere, and if so, remove it from the quotes
      const { timestamp, sender } = msgRemovedProps;
      if (timestamp && sender) {
        const { foundAt, foundProps } = lookupQuoteInStore({
          timestamp,
          quotedMessagesInStore: state.quotedMessages,
        });
        if (foundAt >= 0) {
          window.log.debug(`Deleting quote ${JSON.stringify(foundProps)}`);
          editedQuotedMessages.splice(foundAt, 1);
        }
      }

      return {
        ...state,
        messages: editedMessages,
        quotedMessages: editedQuotedMessages,
        firstUnreadMessageId:
          state.firstUnreadMessageId === extractedMessageId ? null : state.firstUnreadMessageId,
      };
    }

    return state;
  }
  return state;
}

function handleMessagesExpiredOrDeleted(
  state: ConversationsStateType,
  action: PayloadAction<Array<WithConvoId & (WithMessageId | WithMessageHash)>>
): ConversationsStateType {
  let stateCopy = state;
  action.payload.forEach(element => {
    stateCopy = handleMessageExpiredOrDeleted(stateCopy, element);
  });

  return stateCopy;
}

function handleConversationReset(state: ConversationsStateType, action: PayloadAction<string>) {
  const conversationKey = action.payload;
  if (conversationKey === state.selectedConversation) {
    // just empty the list of messages
    return {
      ...state,
      messages: [],
    };
  }
  return state;
}

const conversationsSlice = createSlice({
  name: 'conversations',
  initialState: getEmptyConversationState(),
  reducers: {
    showMessageInfoView(state: ConversationsStateType, action: PayloadAction<string>) {
      // force the right panel to be hidden when showing message detail view
      return { ...state, messageInfoId: action.payload, showRightPanel: false };
    },

    openRightPanel(state: ConversationsStateType) {
      if (
        state.selectedConversation === undefined ||
        !state.conversationLookup[state.selectedConversation]
      ) {
        return state;
      }

      return { ...state, showRightPanel: true };
    },
    closeRightPanel(state: ConversationsStateType) {
      return { ...state, showRightPanel: false, messageInfoId: undefined };
    },
    addMessageIdToSelection(state: ConversationsStateType, action: PayloadAction<string>) {
      if (state.selectedMessageIds.some(id => id === action.payload)) {
        return state;
      }
      return { ...state, selectedMessageIds: [...state.selectedMessageIds, action.payload] };
    },
    removeMessageIdFromSelection(state: ConversationsStateType, action: PayloadAction<string>) {
      const index = state.selectedMessageIds.findIndex(id => id === action.payload);

      if (index === -1) {
        return state;
      }
      return { ...state, selectedMessageIds: state.selectedMessageIds.splice(index, 1) };
    },
    toggleSelectedMessageId(state: ConversationsStateType, action: PayloadAction<string>) {
      const index = state.selectedMessageIds.findIndex(id => id === action.payload);

      if (index === -1) {
        state.selectedMessageIds = [...state.selectedMessageIds, action.payload];
      } else {
        state.selectedMessageIds.splice(index, 1);
      }

      return state;
    },
    resetSelectedMessageIds(state: ConversationsStateType) {
      return { ...state, selectedMessageIds: [] };
    },

    conversationAdded(
      state: ConversationsStateType,
      action: PayloadAction<{
        id: string;
        data: ReduxConversationType;
      }>
    ) {
      const { conversationLookup } = state;

      return {
        ...state,
        conversationLookup: {
          ...conversationLookup,
          [action.payload.id]: action.payload.data,
        },
      };
    },

    conversationsChanged(
      state: ConversationsStateType,
      action: PayloadAction<Array<ReduxConversationType>>
    ) {
      const { payload } = action;

      let updatedState = state;
      if (payload.length) {
        updatedState = applyConversationsChanged(updatedState, payload);
      }

      return updatedState;
    },

    conversationRemoved(state: ConversationsStateType, action: PayloadAction<string>) {
      const { payload: conversationId } = action;
      const { conversationLookup, selectedConversation } = state;
      return {
        ...state,
        conversationLookup: omit(conversationLookup, [conversationId]),
        selectedConversation:
          selectedConversation === conversationId ? undefined : selectedConversation,
      };
    },

    removeAllConversations() {
      return getEmptyConversationState();
    },

    messagesChanged(
      state: ConversationsStateType,
      action: PayloadAction<Array<MessageModelPropsWithoutConvoProps>>
    ) {
      return handleMessagesChangedOrAdded(state, action.payload);
    },

    messagesExpired(
      state: ConversationsStateType,
      action: PayloadAction<Array<WithConvoId & WithMessageId>>
    ) {
      return handleMessagesExpiredOrDeleted(state, action);
    },
    messageHashesExpired(
      state: ConversationsStateType,
      action: PayloadAction<Array<WithConvoId & WithMessageHash>>
    ) {
      return handleMessagesExpiredOrDeleted(state, action);
    },

    messagesDeleted(
      state: ConversationsStateType,
      action: PayloadAction<Array<WithMessageId & WithConvoId>>
    ) {
      return handleMessagesExpiredOrDeleted(state, action);
    },

    conversationReset(state: ConversationsStateType, action: PayloadAction<string>) {
      return handleConversationReset(state, action);
    },

    markConversationFullyRead(state: ConversationsStateType, action: PayloadAction<string>) {
      if (state.selectedConversation !== action.payload) {
        return state;
      }

      let updatedMessages = state.messages;

      // if some are unread, mark them as read
      if (state.messages.some(m => m.propsForMessage.isUnread)) {
        updatedMessages = state.messages.map(m => ({
          ...m,
          propsForMessage: { ...m.propsForMessage, isUnread: false },
        }));
      }

      // keep the unread visible just like in other apps. It will be shown until the user changes convo
      return {
        ...state,
        shouldHighlightMessage: false,
        firstUnreadMessageId: null,

        messages: updatedMessages,
      };
    },
    /**
     * Closes any existing conversation and returns state to the placeholder screen
     */
    resetConversationExternal(state: ConversationsStateType) {
      return { ...getEmptyConversationState(), conversationLookup: state.conversationLookup };
    },
    openConversationExternal(
      state: ConversationsStateType,
      action: PayloadAction<
        FetchMessageSharedResult & {
          conversationKey: string;
          initialMessages: Array<MessageModelPropsWithoutConvoProps>;
          initialQuotes: Array<MessageModelPropsWithoutConvoProps>;
        }
      >
    ) {
      // this is quite hacky, but we don't want to show the showScrollButton if we have only a small amount of messages,
      // or if the first unread message is not far from the most recent one.
      // this is because when a new message get added, we do not add it to redux depending on the showScrollButton state.
      const messagesToConsiderForShowingUnreadBanner = 10;

      let showScrollButton = Boolean(action.payload.firstUnreadMessageId);

      if (
        action.payload.initialMessages?.length <= messagesToConsiderForShowingUnreadBanner ||
        action.payload.initialMessages
          ?.slice(0, messagesToConsiderForShowingUnreadBanner)
          .some(n => n.propsForMessage.id === action.payload.firstUnreadMessageId)
      ) {
        showScrollButton = false;
      }

      return {
        conversationLookup: state.conversationLookup,
        selectedConversation: action.payload.conversationKey,
        mostRecentMessageId: action.payload.mostRecentMessageId ?? null,
        firstUnreadMessageId: action.payload.firstUnreadMessageId ?? null,
        oldestMessageId: action.payload.oldestMessageId ?? null,
        messages: action.payload.initialMessages,
        quotedMessages: action.payload.initialQuotes,

        areMoreMessagesBeingFetched: false,
        showRightPanel: false,
        selectedMessageIds: [],

        messageInfoId: undefined,
        quotedMessage: undefined,

        nextMessageToPlay: undefined,
        showScrollButton,
        animateQuotedMessageId: undefined,
        shouldHighlightMessage: false,
        oldTopMessageId: null,
        oldBottomMessageId: null,
        mentionMembers: [],
      };
    },
    openConversationToSpecificMessage(
      state: ConversationsStateType,
      action: PayloadAction<
        FetchMessageSharedResult & {
          conversationKey: string;
          messageIdToNavigateTo: string;
          shouldHighlightMessage: boolean;
          initialMessages: Array<MessageModelPropsWithoutConvoProps>;
          initialQuotes: Array<MessageModelPropsWithoutConvoProps>;
        }
      >
    ) {
      return {
        ...state,
        selectedConversation: action.payload.conversationKey,
        mostRecentMessageId: action.payload.mostRecentMessageId,
        firstUnreadMessageId: action.payload.firstUnreadMessageId,
        oldestMessageId: action.payload.oldestMessageId,
        areMoreMessagesBeingFetched: false,
        messages: action.payload.initialMessages,
        quotedMessages: action.payload.initialQuotes,
        showScrollButton: Boolean(
          action.payload.messageIdToNavigateTo !== action.payload.mostRecentMessageId
        ),
        animateQuotedMessageId: action.payload.messageIdToNavigateTo,
        shouldHighlightMessage: action.payload.shouldHighlightMessage,
        oldTopMessageId: null,
        oldBottomMessageId: null,
      };
    },
    pushQuotedMessageDetails(
      state: ConversationsStateType,
      action: PayloadAction<MessageModelPropsWithoutConvoProps>
    ) {
      const { payload } = action;
      if (state.selectedConversation === payload.propsForMessage.convoId) {
        const { foundAt } = lookupQuoteInStore({
          timestamp: payload.propsForMessage.timestamp,
          quotedMessagesInStore: state.quotedMessages,
        });
        if (foundAt >= 0) {
          state.quotedMessages[foundAt] = payload;
          return state;
        }
        state.quotedMessages.push(payload);
      }
      return state;
    },
    resetOldTopMessageId(state: ConversationsStateType) {
      state.oldTopMessageId = null;
      return state;
    },
    resetOldBottomMessageId(state: ConversationsStateType) {
      state.oldBottomMessageId = null;
      return state;
    },
    showScrollToBottomButton(state: ConversationsStateType, action: PayloadAction<boolean>) {
      state.showScrollButton = action.payload;
      return state;
    },
    quoteMessage(
      state: ConversationsStateType,
      action: PayloadAction<ReplyingToMessageProps | undefined>
    ) {
      state.quotedMessage = action.payload;
      return state;
    },
    quotedMessageToAnimate(
      state: ConversationsStateType,
      action: PayloadAction<string | undefined>
    ) {
      state.animateQuotedMessageId = action.payload;
      state.shouldHighlightMessage = Boolean(state.animateQuotedMessageId);
      return state;
    },
    setNextMessageToPlayId(
      state: ConversationsStateType,
      action: PayloadAction<string | undefined>
    ) {
      state.nextMessageToPlayId = action.payload;
      return state;
    },
    updateMentionsMembers(
      state: ConversationsStateType,
      action: PayloadAction<Array<SessionSuggestionDataItem>>
    ) {
      window?.log?.info('updating mentions input members length', action.payload?.length);
      state.mentionMembers = action.payload;
      return state;
    },
    markConversationInitialLoadingInProgress(
      state: ConversationsStateType,
      action: PayloadAction<{ conversationKey: string; isInitialFetchingInProgress: boolean }>
    ) {
      window?.log?.info(
        `mark conversation initialLoading ${action.payload.conversationKey}: ${action.payload.isInitialFetchingInProgress}`
      );
      if (state.conversationLookup[action.payload.conversationKey]) {
        state.conversationLookup[action.payload.conversationKey].isInitialFetchingInProgress =
          action.payload.isInitialFetchingInProgress;
      }

      return state;
    },
  },
  extraReducers: (builder: any) => {
    // Add reducers for additional action types here, and handle loading state as needed
    builder.addCase(
      fetchTopMessagesForConversation.fulfilled,
      (
        state: ConversationsStateType,
        action: PayloadAction<FetchedTopMessageResults>
      ): ConversationsStateType => {
        if (!action.payload) {
          return { ...state, areMoreMessagesBeingFetched: false };
        }
        // this is called once the messages are loaded from the db for the currently selected conversation
        const {
          messagesProps,
          conversationKey,
          oldTopMessageId,
          newMostRecentMessageIdInConversation,
          quotedMessagesProps,
        } = action.payload;
        // double check that this update is for the shown convo
        if (conversationKey === state.selectedConversation) {
          return {
            ...state,
            oldTopMessageId,
            messages: messagesProps,
            quotedMessages: quotedMessagesProps,
            areMoreMessagesBeingFetched: false,
            mostRecentMessageId: newMostRecentMessageIdInConversation,
          };
        }
        return state;
      }
    );
    builder.addCase(
      fetchTopMessagesForConversation.pending,
      (state: ConversationsStateType): ConversationsStateType => {
        state.areMoreMessagesBeingFetched = true;
        return state;
      }
    );
    builder.addCase(
      fetchTopMessagesForConversation.rejected,
      (state: ConversationsStateType): ConversationsStateType => {
        state.areMoreMessagesBeingFetched = false;
        return state;
      }
    );
    builder.addCase(
      fetchBottomMessagesForConversation.fulfilled,
      (
        state: ConversationsStateType,
        action: PayloadAction<FetchedBottomMessageResults>
      ): ConversationsStateType => {
        if (!action.payload) {
          return { ...state, areMoreMessagesBeingFetched: false };
        }

        // this is called once the messages are loaded from the db for the currently selected conversation
        const {
          messagesProps,
          quotedMessagesProps,
          conversationKey,
          oldBottomMessageId,
          newMostRecentMessageIdInConversation,
        } = action.payload;
        // double check that this update is for the shown convo
        if (conversationKey === state.selectedConversation) {
          return {
            ...state,
            oldBottomMessageId,
            messages: messagesProps,
            quotedMessages: quotedMessagesProps,
            areMoreMessagesBeingFetched: false,
            mostRecentMessageId: newMostRecentMessageIdInConversation,
          };
        }
        return state;
      }
    );
    builder.addCase(
      fetchBottomMessagesForConversation.pending,
      (state: ConversationsStateType): ConversationsStateType => {
        state.areMoreMessagesBeingFetched = true;
        return state;
      }
    );
    builder.addCase(
      fetchBottomMessagesForConversation.rejected,
      (state: ConversationsStateType): ConversationsStateType => {
        state.areMoreMessagesBeingFetched = false;
        return state;
      }
    );
  },
});

function applyConversationsChanged(
  state: ConversationsStateType,
  payload: Array<ReduxConversationType>
) {
  const { conversationLookup, selectedConversation } = state;

  for (let index = 0; index < payload.length; index++) {
    const convoProps = payload[index];
    const { id } = convoProps;
    // In the `change` case we only modify the lookup if we already had that conversation
    const existing = conversationLookup[id];

    if (!existing) {
      continue;
    }

    if (
      selectedConversation &&
      convoProps.isPrivate &&
      convoProps.id === selectedConversation &&
      convoProps.priority &&
      convoProps.priority < CONVERSATION_PRIORITIES.default &&
      selectedConversation !== UserUtils.getOurPubKeyStrFromCache()
    ) {
      // A private conversation hidden cannot be selected (except the Note To Self)
      // When opening a hidden conversation, we unhide it so it can be selected again.
      state.selectedConversation = undefined;
    }

    state.conversationLookup[id] = {
      ...convoProps,
      isInitialFetchingInProgress: existing.isInitialFetchingInProgress,
    };
  }

  return state;
}

export const { actions, reducer } = conversationsSlice;
export const {
  // conversation and messages list
  conversationAdded,
  conversationsChanged,
  conversationRemoved,
  removeAllConversations,
  messagesExpired,
  messageHashesExpired,
  messagesDeleted,
  conversationReset,
  messagesChanged,
  resetOldTopMessageId,
  resetOldBottomMessageId,
  markConversationFullyRead,
  pushQuotedMessageDetails,
  // layout stuff
  showMessageInfoView,
  openRightPanel,
  closeRightPanel,
  addMessageIdToSelection,
  resetSelectedMessageIds,
  toggleSelectedMessageId,
  quoteMessage,
  showScrollToBottomButton,
  quotedMessageToAnimate,
  setNextMessageToPlayId,
  updateMentionsMembers,
  resetConversationExternal,
  markConversationInitialLoadingInProgress,
} = actions;

async function unmarkAsForcedUnread(convoId: string) {
  const convo = ConvoHub.use().get(convoId);
  if (convo && convo.isMarkedUnread()) {
    // we just opened it and it was forced "Unread", so we reset the unread state here
    await convo.markAsUnread(false, true);
  }
}

export async function openConversationWithMessages(args: {
  conversationKey: string;
  messageId: string | null;
}) {
  const { conversationKey, messageId } = args;

  if (Storage.getBoolOr(SettingsKey.showOnboardingAccountJustCreated, true)) {
    await Storage.put(SettingsKey.showOnboardingAccountJustCreated, false);
  }

  await DisappearingMessages.destroyExpiredMessages();
  await unmarkAsForcedUnread(conversationKey);

  const {
    messagesProps: initialMessages,
    quotedMessagesProps,
    firstUnreadMessageId,
    mostRecentMessageId,
    oldestMessageId,
  } = await getMessages({
    conversationKey,
    messageId: messageId || null,
  });

  window.inboxStore?.dispatch(
    actions.openConversationExternal({
      conversationKey,
      initialMessages,
      initialQuotes: quotedMessagesProps,
      firstUnreadMessageId,
      mostRecentMessageId,
      oldestMessageId,
    })
  );
  window.inboxStore?.dispatch(sectionActions.resetRightOverlayMode());

  if (window.inboxStore) {
    if (getFeatureFlag('proAvailable')) {
      await handleTriggeredCTAs(window.inboxStore.dispatch, false);
    }
  }
}

export async function openConversationToSpecificMessage(args: {
  conversationKey: string;
  messageIdToNavigateTo: string;
  shouldHighlightMessage: boolean;
}) {
  const { conversationKey, messageIdToNavigateTo, shouldHighlightMessage } = args;
  await unmarkAsForcedUnread(conversationKey);

  const {
    messagesProps: messagesAroundThisMessage,
    quotedMessagesProps,
    mostRecentMessageId,
    firstUnreadMessageId,
    oldestMessageId,
  } = await getMessages({
    conversationKey,
    messageId: messageIdToNavigateTo,
  });

  // we do not care about the first unread message id when opening to a specific message
  window.inboxStore?.dispatch(
    actions.openConversationToSpecificMessage({
      conversationKey,
      messageIdToNavigateTo,
      mostRecentMessageId,
      shouldHighlightMessage,
      initialMessages: messagesAroundThisMessage,
      initialQuotes: quotedMessagesProps,
      firstUnreadMessageId,
      oldestMessageId,
    })
  );
}
