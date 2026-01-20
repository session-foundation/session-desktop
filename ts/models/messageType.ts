import { PubkeyType } from 'libsession_util_nodejs';
import { defaultsDeep } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import {
  DisappearingMessageType,
  ExpirationTimerUpdate,
} from '../session/disappearing_messages/types';
import { PropsForMessageWithConvoProps } from '../state/ducks/conversations';
import { AttachmentTypeWithPath } from '../types/Attachment';
import { Reaction, ReactionList, SortedReactionList } from '../types/Reaction';
import { READ_MESSAGE_STATE } from './conversationAttributes';
import {
  LastMessageStatusType,
  CallNotificationType,
  InteractionNotificationType,
} from '../state/ducks/types';
import type { SignalService } from '../protobuf';
import type { Quote } from '../session/messages/outgoing/visibleMessage/VisibleMessage';

export type MessageModelType = 'incoming' | 'outgoing';

/**
 * The shared attributes that are for both (MessageAttributes & MessageAttributesOptionals) optionals.
 */
type SharedMessageAttributes = {
  /**
   * The sender/author of that message
   */
  source: string;
  /**
   * The quoted message. We only need a timestamp to find the corresponding message in the DB.
   * - We already know it is in the current conversation
   * - We assume there are no two messages timestamps to the millisecond from the same (or different) author in the same conversation.
   *
   * But because, a quoted reference not found should still display the author, we also need keep the author here. We just don't use it for lookup
   */
  quote?: Quote;
  received_at?: number;
  sent_at?: number;
  /**
   * the link preview details
   */
  preview?: any;
  reaction?: Reaction;
  reacts?: ReactionList;
  reactsIndex?: number;
  /**
   * the text associated with this message (can be undefined for control messages, or for attachments only messages. etc)
   */
  body?: string;
  expirationType?: DisappearingMessageType;
  expires_at?: number;
  expirationTimerUpdate?: ExpirationTimerUpdate;
  type: MessageModelType;
  group_update?: MessageGroupUpdate;
  groupInvitation?: { url: string | undefined; name: string } | undefined;
  attachments?: any;
  conversationId: string;
  errors?: string;
  /**
   * timestamp is the sent_at timestamp, which is the envelope.timestamp
   */
  timestamp?: number;
  status?: LastMessageStatusType;
  /**
   * The serverId is the id on the open group server itself.
   * Each message sent to an open group gets a serverId.
   * This is not the id for the server, but the id ON the server.
   *
   * This field is not set for a message not on an opengroup server.
   */
  serverId?: number;
  /**
   * This is the timestamp of that messages as it was saved by the Open group server.
   * We rely on this one to order Open Group messages.
   * This field is not set for a message not on an opengroup server.
   */
  serverTimestamp?: number;
  /**
   * This is used for when a user screenshots or saves an attachment you sent.
   * We display a small message just below the message referenced
   */
  dataExtractionNotification?: DataExtractionNotificationMsg;

  /**
   * For displaying a message to notifying when a request has been accepted.
   */
  messageRequestResponse?: {
    // keeping it as a object in case we ever add a field here.
    // Note: we had isApproved field, but it was unused so I got rid of it
  };
  /**
   * This field is used for unsending messages and used in sending update expiry, get expiries and unsend message requests.
   */
  messageHash?: string;

  /**
   * This field is used for unsending messages and used in sending unsend message requests.
   */
  isDeleted?: boolean;

  callNotificationType?: CallNotificationType;

  /**
   * This is used when a user has performed an interaction (hiding, leaving, etc.) on a conversation. At the moment, this is only used for showing interaction errors.
   */
  interactionNotification?: InteractionNotificationType;
};

/**
 * Attributes that can be optional or not depending on if the message was already constructed or not.
 */
type NotSharedMessageAttributes = {
  /**
   * The local id of this message (i.e. an id only used locally).
   * Added on commit() if unset before that
   */
  id: string;
  direction: MessageModelType;

  /** in seconds, 0 means no expiration */
  expireTimer: number;
  /** when the expireTimer above started to count, in milliseconds */
  expirationStartTimestamp: number;
  read_by: Array<string>; // we actually only care about the length of this. values are not used for anything

  hasAttachments: 1 | 0;
  hasFileAttachments: 1 | 0;
  hasVisualMediaAttachments: 1 | 0;
  /**
   * 1 means unread, 0 or anything else is read.
   * You can use the values from READ_MESSAGE_STATE.unread and READ_MESSAGE_STATE.read
   */
  unread: number;

  sent_to: Array<string>;
  sent: boolean;

  /**
   * `sentSync` is set to true means we just triggered the sync message for this Private Chat message.
   * We did not yet get the message sent confirmation, it was just added to the Outgoing MessageQueue
   */
  sentSync: boolean;

  /**
   * `synced` is set to true means that this message was successfully sent by our current device to our other devices.
   * It is set to true when the MessageQueue did effectively sent our sync message without errors.
   */
  synced: boolean;
  sync: boolean;

  /**
   * This is a bitset stringified bigint of the features that are enabled for this message.
   * We save those as a bitset to make sure we display once we upgrade a set of features we didn't know before.
   * This is a string, because bigints cannot be sent over ipc.
   */
  proMessageBitset?: string;

  /**
   * This is a bitset stringified bigint of the features that were used on the profile of the user when re received that message.
   * We save those as a bitset to make sure we display once we upgrade a set of features we didn't know before.
   * This is a string, because bigints cannot be sent over ipc.
   */
  proProfileBitset?: string;
};

export type MessageAttributes = SharedMessageAttributes & NotSharedMessageAttributes;

/**
 * The attributes of a message as they can be used to construct a message before the first commit().
 * Most of those are optionals, but a few are required.
 */
export type MessageAttributesOptionals = SharedMessageAttributes &
  Partial<NotSharedMessageAttributes>;

export interface MessageRequestResponseMsg {
  source: string;
  isApproved: boolean;
}

export enum MessageDirection {
  outgoing = 'outgoing',
  incoming = 'incoming',
  any = '%',
}

export type DataExtractionNotificationMsg = {
  type: SignalService.DataExtractionNotification.Type;
};

export type PropsForDataExtractionNotification = DataExtractionNotificationMsg;

export type MessageGroupUpdate = {
  left?: Array<PubkeyType>;
  joined?: Array<PubkeyType>;
  joinedWithHistory?: Array<PubkeyType>;
  kicked?: Array<PubkeyType>;
  promoted?: Array<PubkeyType>;
  name?: string;
  avatarChange?: boolean;
};

/**
 * This function mutates optAttributes
 * @param optAttributes the entry object attributes to set the defaults to.
 */
export const fillMessageAttributesWithDefaults = (
  optAttributes: MessageAttributesOptionals
): MessageAttributes => {
  const defaulted = defaultsDeep(optAttributes, {
    expireTimer: 0, // disabled
    id: uuidv4(),
    unread: READ_MESSAGE_STATE.read, // if nothing is set, this message is considered read
  });
  // this is just to cleanup a bit the db. delivered and delivered_to were removed, so every time we load a message
  // we make sure to clean those fields in the json.
  // the next commit() will write that to the disk
  if (defaulted.delivered) {
    delete defaulted.delivered;
  }
  if (defaulted.delivered_to) {
    delete defaulted.delivered_to;
  }
  return defaulted;
};

/**
 * Those props are the one generated from a single Message improved by the one by the app itself.
 * Some of the one added comes from the MessageList, some from redux, etc..
 */
export type MessageRenderingProps = PropsForMessageWithConvoProps & {
  disableMenu?: boolean;
  /** Note: this should be formatted for display */
  attachments?: Array<AttachmentTypeWithPath>; // vs Array<PropsForAttachment>;

  // whether or not to allow selecting the message
  multiSelectMode: boolean;
  firstMessageOfSeries: boolean;
  lastMessageOfSeries: boolean;

  sortedReacts?: SortedReactionList;
};
