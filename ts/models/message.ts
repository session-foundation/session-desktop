import autoBind from 'auto-bind';
import { filesize } from 'filesize';
import { GroupPubkeyType, PubkeyType } from 'libsession_util_nodejs';
import { debounce, isEmpty, isEqual, isString, size as lodashSize, uniq } from 'lodash';
import { SignalService } from '../protobuf';
import { ConvoHub } from '../session/conversations';
import { ContentMessageNoProfile } from '../session/messages/outgoing';
import { ClosedGroupV2VisibleMessage } from '../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { PubKey } from '../session/types';
import {
  MessageUtils,
  UserUtils,
  attachmentIdAsStrFromUrl,
  uploadAttachmentsToFileServer,
  uploadLinkPreviewToFileServer,
} from '../session/utils';
import {
  MessageAttributes,
  MessageAttributesOptionals,
  MessageGroupUpdate,
  fillMessageAttributesWithDefaults,
  type DataExtractionNotificationMsg,
} from './messageType';

import { Data } from '../data/data';
import { OpenGroupData } from '../data/opengroups';
import { SettingsKey } from '../data/settings-key';
import { isUsAnySogsFromCache } from '../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { SnodeNamespaces } from '../session/apis/snode_api/namespaces';
import { DURATION } from '../session/constants';
import { DisappearingMessages } from '../session/disappearing_messages';
import { TimerOptions } from '../session/disappearing_messages/timerOptions';
import {
  OpenGroupVisibleMessage,
  OpenGroupVisibleMessageParams,
} from '../session/messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import {
  VisibleMessage,
  VisibleMessageParams,
} from '../session/messages/outgoing/visibleMessage/VisibleMessage';
import { uploadAttachmentsV3, uploadLinkPreviewsV3 } from '../session/utils/AttachmentsV2';
import { isUsFromCache } from '../session/utils/User';
import { buildSyncMessage } from '../session/utils/sync/syncUtils';
import {
  FindAndFormatContactType,
  MessageModelPropsWithoutConvoProps,
  PropsForAttachment,
  PropsForExpirationTimer,
  PropsForCommunityInvitation,
  PropsForGroupUpdate,
  PropsForGroupUpdateAdd,
  PropsForGroupUpdateAvatarChange,
  PropsForGroupUpdateKicked,
  PropsForGroupUpdateLeft,
  PropsForGroupUpdateName,
  PropsForGroupUpdatePromoted,
  PropsForMessageWithoutConvoProps,
  PropsForQuote,
  messagesChanged,
} from '../state/ducks/conversations';
import { AttachmentTypeWithPath, isVoiceMessage } from '../types/Attachment';
import {
  deleteExternalMessageFiles,
  getAbsoluteAttachmentPath,
  loadAttachmentData,
  loadPreviewData,
} from '../types/MessageAttachment';
import { ReactionList } from '../types/Reaction';
import { getAttachmentMetadata } from '../types/message/initializeAttachmentMetadata';
import { assertUnreachable, roomHasBlindEnabled } from '../types/sqlSharedTypes';
import { LinkPreviews } from '../util/linkPreviews';
import { Notifications } from '../util/notifications';
import { Storage } from '../util/storage';
import { ConversationModel } from './conversation';
import { READ_MESSAGE_STATE } from './conversationAttributes';
import { ConversationInteractionStatus, ConversationInteractionType } from '../interactions/types';
import { LastMessageStatusType, type PropsForCallNotification } from '../state/ducks/types';
import {
  getGroupDisplayPictureChangeStr,
  getGroupNameChangeStr,
  getJoinedGroupUpdateChangeStr,
  getKickedGroupUpdateStr,
  getLeftGroupUpdateChangeStr,
  getPromotedGroupUpdateChangeStr,
} from './groupUpdate';
import { NetworkTime } from '../util/NetworkTime';
import { MessageQueue, MessageSender } from '../session/sending';
import { getTimerNotificationStr } from './timerNotifications';
import {
  ExpirationTimerUpdate,
  type DisappearingMessageType,
} from '../session/disappearing_messages/types';
import { Model } from './models';
import { ReduxOnionSelectors } from '../state/selectors/onions';
import { tStrippedWithObj, tr, tStripped } from '../localization/localeTools';
import type { QuotedAttachmentType } from '../components/conversation/message/message-content/quote/Quote';
import { ProFeatures, ProMessageFeature } from './proMessageFeature';
import { privateSet, privateSetKey } from './modelFriends';
import { getFeatureFlag } from '../state/ducks/types/releasedFeaturesReduxTypes';
import type { OutgoingProMessageDetails } from '../types/message/OutgoingProMessageDetails';
import { longOrNumberToBigInt } from '../types/Bigint';

// tslint:disable: cyclomatic-complexity

export class MessageModel extends Model<MessageAttributes> {
  constructor(attributes: MessageAttributesOptionals & { skipTimerInit?: boolean }) {
    const filledAttrs = fillMessageAttributesWithDefaults(attributes);
    super(filledAttrs);

    if (!this.id) {
      throw new Error('A message always needs to have an id.');
    }
    if (!this.get('conversationId')) {
      throw new Error('A message always needs to have an conversationId.');
    }
    if (!attributes.skipTimerInit) {
      void this.setToExpire();
    }
    autoBind(this);

    if (window) {
      window.contextMenuShown = false;
    }

    this.getMessageModelProps();
  }

  public getMessageModelProps(): MessageModelPropsWithoutConvoProps {
    const propsForDataExtractionNotification = this.getPropsForDataExtractionNotification();
    const propsForCommunityInvitation = this.getPropsForCommunityInvitation();
    const propsForGroupUpdateMessage = this.getPropsForGroupUpdateMessage();
    const propsForTimerNotification = this.getPropsForTimerNotification();
    const isMessageResponse = this.isMessageRequestResponse();
    const callNotificationType = this.get('callNotificationType');
    const interactionNotification = this.getInteractionNotification();

    const messageProps: MessageModelPropsWithoutConvoProps = {
      propsForMessage: this.getPropsForMessage(),
    };
    if (propsForDataExtractionNotification) {
      messageProps.propsForDataExtractionNotification = propsForDataExtractionNotification;
    }
    if (isMessageResponse) {
      messageProps.propsForMessageRequestResponse = {};
    }
    if (propsForCommunityInvitation) {
      messageProps.propsForCommunityInvitation = propsForCommunityInvitation;
    }
    if (propsForGroupUpdateMessage) {
      messageProps.propsForGroupUpdateMessage = propsForGroupUpdateMessage;
    }
    if (propsForTimerNotification) {
      messageProps.propsForTimerNotification = propsForTimerNotification;
    }

    if (callNotificationType) {
      const propsForCallNotification: PropsForCallNotification = {
        messageId: this.id,
        notificationType: callNotificationType,
      };
      messageProps.propsForCallNotification = propsForCallNotification;
    }

    if (interactionNotification) {
      messageProps.propsForInteractionNotification = {
        notificationType: interactionNotification,
      };
    }

    return messageProps;
  }

  public idForLogging() {
    return `msg(${this.id}, ${this.getConversation()?.idForLogging()}, ${this.get('sent_at')})`;
  }

  public isExpirationTimerUpdate() {
    return !isEmpty(this.getExpirationTimerUpdate());
  }

  public isControlMessage() {
    return (
      this.isExpirationTimerUpdate() ||
      this.isDataExtractionNotification() ||
      this.isMessageRequestResponse() ||
      this.isGroupUpdate()
    );
  }

  public isIncoming() {
    return this.get('type') === 'incoming' || this.get('direction') === 'incoming';
  }

  public isUnread() {
    const unreadField = this.get('unread');

    return !!unreadField;
  }

  // Important to allow for this.set({ unread}), save to db, then fetch()
  // to propagate. We don't want the unset key in the db so our unread index
  // stays small.
  public merge(model: any) {
    const attributes = model.attributes || model;

    const { unread } = attributes;
    if (unread === undefined) {
      this.set({ unread: READ_MESSAGE_STATE.read });
    }

    this.set(attributes);
  }

  private isCommunityInvitation() {
    return !!this.getCommunityInvitation();
  }
  public getCommunityInvitation() {
    return this.get('groupInvitation');
  }

  private isMessageRequestResponse() {
    return !!this.get('messageRequestResponse');
  }

  private isDataExtractionNotification() {
    // if set to {} this returns true
    return !isEmpty(this.get('dataExtractionNotification'));
  }

  private isCallNotification() {
    return !!this.get('callNotificationType');
  }

  private isInteractionNotification() {
    return !!this.getInteractionNotification();
  }
  public getInteractionNotification() {
    return this.get('interactionNotification');
  }

  public getNotificationText(): string {
    const groupUpdate = this.getGroupUpdateAsArray();
    if (groupUpdate) {
      const isGroupV2 = PubKey.is03Pubkey(this.get('conversationId'));
      const groupName =
        this.getConversation()?.getNicknameOrRealUsernameOrPlaceholder() || tr('unknown');

      if (groupUpdate.left) {
        return tStrippedWithObj(getLeftGroupUpdateChangeStr(groupUpdate.left));
      }

      if (groupUpdate.name) {
        return tStrippedWithObj(getGroupNameChangeStr(groupUpdate.name));
      }

      if (groupUpdate.avatarChange) {
        return tStrippedWithObj(getGroupDisplayPictureChangeStr());
      }

      if (groupUpdate.joined?.length) {
        const opts = getJoinedGroupUpdateChangeStr(groupUpdate.joined, isGroupV2, false, groupName);
        return tStrippedWithObj(opts);
      }

      if (groupUpdate.joinedWithHistory?.length) {
        const opts = getJoinedGroupUpdateChangeStr(
          groupUpdate.joinedWithHistory,
          true,
          true,
          groupName
        );
        return tStrippedWithObj(opts);
      }

      if (groupUpdate.kicked?.length) {
        const opts = getKickedGroupUpdateStr(groupUpdate.kicked, groupName);
        return tStrippedWithObj(opts);
      }
      if (groupUpdate.promoted?.length) {
        const opts = getPromotedGroupUpdateChangeStr(groupUpdate.promoted);
        return tStrippedWithObj(opts);
      }
      window.log.warn('did not build a specific change for getDescription of ', groupUpdate);

      return tStripped('groupUpdated');
    }

    if (this.isCommunityInvitation()) {
      return `😎 ${tStripped('communityInvitation')}`;
    }

    if (this.isDataExtractionNotification()) {
      const dataExtraction = this.get(
        'dataExtractionNotification'
      ) as DataExtractionNotificationMsg;
      const authorName = ConvoHub.use().getNicknameOrRealUsernameOrPlaceholder(this.get('source'));
      const isScreenshot =
        dataExtraction.type === SignalService.DataExtractionNotification.Type.SCREENSHOT;
      return tStripped(isScreenshot ? 'screenshotTaken' : 'attachmentsMediaSaved', {
        name: authorName,
      });
    }
    if (this.isCallNotification()) {
      const name = ConvoHub.use().getNicknameOrRealUsernameOrPlaceholder(
        this.get('conversationId')
      );
      const callNotificationType = this.get('callNotificationType');
      if (callNotificationType === 'missed-call') {
        return tStripped('callsMissedCallFrom', { name });
      }
      if (callNotificationType === 'started-call') {
        return tStripped('callsYouCalled', { name });
      }
      if (callNotificationType === 'answered-a-call') {
        return tStripped('callsInProgress');
      }
    }

    const interactionNotification = this.getInteractionNotification();
    if (interactionNotification) {
      const { interactionType, interactionStatus } = interactionNotification;

      // NOTE For now we only show interaction errors in the message history
      if (interactionStatus === ConversationInteractionStatus.Error) {
        const convo = ConvoHub.use().get(this.get('conversationId'));

        if (convo) {
          const isGroup = !convo.isPrivate();
          const isCommunity = convo.isOpenGroupV2();

          switch (interactionType) {
            case ConversationInteractionType.Hide:
              // there is no text for hiding changes
              return '';
            case ConversationInteractionType.Leave:
              return isCommunity
                ? tStripped('communityLeaveError', {
                    community_name: convo.getNicknameOrRealUsernameOrPlaceholder(),
                  })
                : isGroup
                  ? tStripped('groupLeaveErrorFailed', {
                      group_name: convo.getNicknameOrRealUsernameOrPlaceholder(),
                    })
                  : '';
            default:
              assertUnreachable(
                interactionType,
                `Message.getDescription: Missing case error "${interactionType}"`
              );
          }
        }
      }
    }

    if (this.get('reaction')) {
      const reaction = this.get('reaction');
      if (reaction && reaction.emoji && reaction.emoji !== '') {
        return tStripped('emojiReactsNotification', { emoji: reaction.emoji });
      }
    }
    if (this.isExpirationTimerUpdate()) {
      const expireTimerUpdate = this.getExpirationTimerUpdate() as ExpirationTimerUpdate; // the isExpirationTimerUpdate above enforces this
      const expireTimer = expireTimerUpdate.expireTimer;
      const convo = this.getConversation();
      if (!convo) {
        return '';
      }

      const expirationMode = DisappearingMessages.changeToDisappearingConversationMode(
        convo,
        expireTimerUpdate?.expirationType,
        expireTimer
      );

      const source = this.get('source');
      const i18nProps = getTimerNotificationStr({
        convoId: convo.id,
        author: source as PubkeyType,
        expirationMode,
        isGroup: convo.isGroup(),
        timespanSeconds: expireTimer,
      });

      return tStrippedWithObj(i18nProps);
    }
    const body = this.get('body');
    if (body) {
      let bodyMentionsMappedToNames = body;
      // regex with a 'g' to ignore part groups
      const regex = new RegExp(`@${PubKey.regexForPubkeys}`, 'g');
      const pubkeysInDesc = body.match(regex);
      (pubkeysInDesc || []).forEach((pubkeyWithAt: string) => {
        const pubkey = pubkeyWithAt.slice(1);
        const isUS = isUsAnySogsFromCache(pubkey);
        const displayName = ConvoHub.use().getNicknameOrRealUsernameOrPlaceholder(pubkey);
        if (isUS) {
          bodyMentionsMappedToNames = bodyMentionsMappedToNames?.replace(
            pubkeyWithAt,
            `@${tr('you')}`
          );
        } else if (displayName && displayName.length) {
          bodyMentionsMappedToNames = bodyMentionsMappedToNames?.replace(
            pubkeyWithAt,
            `@${displayName}`
          );
        }
      });
      if (this.getConversation()?.isOpenGroupV2() || this.getConversation()?.isClosedGroupV2()) {
        const source = this.get('source');

        const author = isUsAnySogsFromCache(source)
          ? tr('you')
          : ConvoHub.use().getNicknameOrRealUsernameOrPlaceholder(source);
        return tr('messageSnippetGroup', { author, message_snippet: bodyMentionsMappedToNames });
      }
      return bodyMentionsMappedToNames;
    }

    // Note: we want this after the check for a body as we want to display the body if we have one.
    if ((this.get('attachments') || []).length) {
      return tStripped('contentDescriptionMediaMessage');
    }

    return '';
  }

  /**
   * Remove from the DB all the attachments linked to that message.
   * Note: does not commit the changes to the DB, on purpose.
   * When we cleanup(), we always want to remove the message afterwards. So no commit() calls are made.
   *
   */
  public async cleanup() {
    await deleteExternalMessageFiles(this.attributes);
    // Note: we don't commit here, because when we do cleanup, we always
    // want to cleanup right before deleting the message itself.
  }

  private getPropsForTimerNotification(): PropsForExpirationTimer | null {
    if (!this.isExpirationTimerUpdate()) {
      return null;
    }

    const timerUpdate = this.getExpirationTimerUpdate();
    const convo = this.getConversation();

    if (!timerUpdate || !this.get('source') || !convo) {
      return null;
    }

    const { expireTimer } = timerUpdate;
    const expirationMode = DisappearingMessages.changeToDisappearingConversationMode(
      convo,
      timerUpdate.expirationType,
      expireTimer || 0
    );

    const timespanText = TimerOptions.getName(expireTimer || 0);

    const props: PropsForExpirationTimer = {
      timespanText,
      timespanSeconds: expireTimer || 0,
      expirationMode: expirationMode || 'off',
    };

    return props;
  }

  private getPropsForCommunityInvitation(): PropsForCommunityInvitation | null {
    const invitation = this.getCommunityInvitation();
    if (!invitation || !invitation.url) {
      return null;
    }

    return {
      serverName: invitation.name,
      fullUrl: invitation.url,
    };
  }

  private getPropsForDataExtractionNotification(): DataExtractionNotificationMsg | null {
    const dataExtraction = this.get('dataExtractionNotification');
    if (!dataExtraction || !dataExtraction.type) {
      return null;
    }
    return { type: dataExtraction.type };
  }

  private getPropsForGroupUpdateMessage(): PropsForGroupUpdate | null {
    const groupUpdate = this.getGroupUpdateAsArray();
    if (!groupUpdate || isEmpty(groupUpdate)) {
      return null;
    }

    if (groupUpdate.joined?.length) {
      const change: PropsForGroupUpdateAdd = {
        type: 'add',
        added: groupUpdate.joined as Array<PubkeyType>,
        withHistory: false,
      };
      return { change };
    }
    if (groupUpdate.joinedWithHistory?.length) {
      const change: PropsForGroupUpdateAdd = {
        type: 'add',
        added: groupUpdate.joinedWithHistory as Array<PubkeyType>,
        withHistory: true,
      };
      return { change };
    }

    if (groupUpdate.kicked?.length) {
      const change: PropsForGroupUpdateKicked = {
        type: 'kicked',
        kicked: groupUpdate.kicked as Array<PubkeyType>,
      };
      return { change };
    }

    if (groupUpdate.left?.length) {
      const change: PropsForGroupUpdateLeft = {
        type: 'left',
        left: groupUpdate.left as Array<PubkeyType>,
      };
      return { change };
    }

    if (groupUpdate.promoted?.length) {
      const change: PropsForGroupUpdatePromoted = {
        type: 'promoted',
        promoted: groupUpdate.promoted as Array<PubkeyType>,
      };
      return { change };
    }
    if (groupUpdate.name) {
      const change: PropsForGroupUpdateName = {
        type: 'name',
        newName: groupUpdate.name,
      };
      return { change };
    }
    if (groupUpdate.avatarChange) {
      const change: PropsForGroupUpdateAvatarChange = {
        type: 'avatarChange',
      };
      return { change };
    }

    return null;
  }

  public getMessagePropStatus(): LastMessageStatusType {
    if (this.hasErrors()) {
      return 'error';
    }

    // Only return the status on outgoing messages
    if (!this.isOutgoing()) {
      return undefined;
    }

    // some incoming legacy group updates are outgoing, but when synced to our other devices have just the received_at field set.
    // when that is the case, we don't want to render the spinning 'sending' state
    if (
      (this.isExpirationTimerUpdate() || this.isDataExtractionNotification()) &&
      this.get('received_at')
    ) {
      return undefined;
    }

    if (
      this.isDataExtractionNotification() ||
      this.isCallNotification() ||
      this.isInteractionNotification()
    ) {
      return undefined;
    }

    const readBy = this.get('read_by') || [];
    if (Storage.get(SettingsKey.settingsReadReceipt) && readBy.length > 0) {
      return 'read';
    }
    const sent = this.get('sent');
    const sentTo = this.get('sent_to') || [];

    if (sent || sentTo.length > 0) {
      return 'sent';
    }

    return 'sending';
  }

  public getPropsForMessage(): PropsForMessageWithoutConvoProps {
    const sender = this.getSource();
    const expirationType = this.getExpirationType();
    const expirationDurationMs = this.getExpireTimerSeconds()
      ? this.getExpireTimerSeconds() * DURATION.SECONDS
      : null;

    const expireTimerStart = this.getExpirationStartTimestamp() || null;

    const expirationTimestamp =
      expirationType && expireTimerStart && expirationDurationMs
        ? expireTimerStart + expirationDurationMs
        : null;

    const attachments = this.get('attachments') || [];
    const isTrustedForAttachmentDownload = this.isTrustedForAttachmentDownload();
    const proFeaturesUsed = this.getProFeaturesUsed();
    const body = this.get('body');
    const props: PropsForMessageWithoutConvoProps = {
      id: this.id,
      direction: this.isIncoming() ? 'incoming' : 'outgoing',
      timestamp: this.get('sent_at') || 0,
      sender,
      convoId: this.get('conversationId'),
    };
    if (body) {
      props.text = body;
    }
    if (this.get('isDeleted')) {
      props.isDeleted = !!this.get('isDeleted');
    }

    if (this.getMessageHash()) {
      props.messageHash = this.getMessageHash();
    }
    if (this.get('received_at')) {
      props.receivedAt = this.get('received_at');
    }
    if (this.get('serverTimestamp')) {
      props.serverTimestamp = this.get('serverTimestamp');
    }
    if (this.get('serverId')) {
      props.serverId = this.get('serverId');
    }
    if (expirationType) {
      props.expirationType = expirationType;
    }
    if (expirationDurationMs) {
      props.expirationDurationMs = expirationDurationMs;
    }
    if (expirationTimestamp) {
      props.expirationTimestamp = expirationTimestamp;
    }
    if (isTrustedForAttachmentDownload) {
      props.isTrustedForAttachmentDownload = isTrustedForAttachmentDownload;
    }
    if (proFeaturesUsed.length) {
      props.proFeaturesUsed = proFeaturesUsed;
    }
    const isUnread = this.isUnread();
    if (isUnread) {
      props.isUnread = isUnread;
    }
    const isExpired = this.isExpired();
    if (isExpired) {
      props.isExpired = isExpired;
    }
    const previews = this.getPropsForPreview();
    if (previews && previews.length) {
      props.previews = previews;
    }
    const reacts = this.getPropsForReacts();
    if (reacts && Object.keys(reacts).length) {
      props.reacts = reacts;
    }
    const quote = this.getPropsForQuote();
    if (quote) {
      props.quote = quote;
    }
    const status = this.getMessagePropStatus();
    if (status) {
      props.status = status;
    }

    const attachmentsProps = attachments.map(this.getPropsForAttachment);
    if (attachmentsProps && attachmentsProps.length) {
      props.attachments = attachmentsProps;
    }

    return props;
  }

  private getPropsForPreview(): Array<any> | null {
    const previews = this.get('preview') || null;

    if (!previews || previews.length === 0) {
      return null;
    }

    return previews.map((preview: any) => {
      let image: PropsForAttachment | null = null;
      try {
        if (preview.image) {
          image = this.getPropsForAttachment(preview.image);
        }
      } catch (e) {
        window?.log?.info('Failed to show preview');
      }

      return {
        ...preview,
        domain: LinkPreviews.getDomain(preview.url),
        image,
      };
    });
  }

  private getPropsForReacts(): ReactionList | null {
    return this.get('reacts') || null;
  }

  private getPropsForQuote(): PropsForQuote | null {
    return this.get('quote') || null;
  }

  public getPropsForAttachment(attachment: AttachmentTypeWithPath): PropsForAttachment | null {
    if (!attachment) {
      return null;
    }

    const {
      path,
      contentType,
      width,
      height,
      pending,
      flags,
      size,
      screenshot,
      thumbnail,
      fileName,
      caption,
      isVoiceMessage: isVoiceMessageFromDb,
    } = attachment;

    const isVoiceMessageBool =
      !!isVoiceMessageFromDb ||
      // eslint-disable-next-line no-bitwise
      !!(flags && flags & SignalService.AttachmentPointer.Flags.VOICE_MESSAGE) ||
      false;

    return {
      contentType,
      caption,
      size: size || 0,
      width: width || 0,
      height: height || 0,
      path,
      fileName,
      fileSize: size ? filesize(size, { base: 10 }) : null,
      isVoiceMessage: isVoiceMessageBool,
      pending: Boolean(pending),
      url: path ? getAbsoluteAttachmentPath(path) : '',
      screenshot: screenshot
        ? {
            ...screenshot,
            url: getAbsoluteAttachmentPath(screenshot.path),
          }
        : null,
      thumbnail: thumbnail
        ? {
            ...thumbnail,
            url: getAbsoluteAttachmentPath(thumbnail.path),
          }
        : null,
    };
  }

  /**
   * Uploads attachments, previews and quotes.
   *
   * @returns The uploaded data which includes: body, attachments, preview and quote.
   * Also returns the uploaded ids to include in the message post so that those attachments are linked to that message.
   */
  public async uploadData() {
    const start = Date.now();
    const finalAttachments = await Promise.all(
      (this.get('attachments') || []).map(loadAttachmentData)
    );
    const body = this.get('body');

    const previewWithData = await loadPreviewData(this.get('preview'));

    const { hasAttachments, hasVisualMediaAttachments, hasFileAttachments } =
      getAttachmentMetadata(this);
    this.set({ hasAttachments, hasVisualMediaAttachments, hasFileAttachments });
    await this.commit();

    const conversation = this.getConversation();

    let attachmentPromise;
    let linkPreviewPromise;
    const fileIdsToLink: Array<string> = [];

    // we can only send a single preview
    const firstPreviewWithData = previewWithData?.[0] || null;

    // we want to go for the v1, if this is an OpenGroupV1 or not an open group at all
    if (conversation?.isOpenGroupV2()) {
      const openGroupV2 = conversation.toOpenGroupV2();
      attachmentPromise = uploadAttachmentsV3(finalAttachments, openGroupV2);
      linkPreviewPromise = uploadLinkPreviewsV3(firstPreviewWithData, openGroupV2);
    } else {
      // if that's not an sogs, the file is uploaded to the file server instead
      attachmentPromise = uploadAttachmentsToFileServer(finalAttachments);
      linkPreviewPromise = uploadLinkPreviewToFileServer(firstPreviewWithData);
    }

    const [attachments, preview] = await Promise.all([attachmentPromise, linkPreviewPromise]);
    fileIdsToLink.push(...attachments.map(m => attachmentIdAsStrFromUrl(m.url)));
    if (preview && preview.image?.url) {
      fileIdsToLink.push(attachmentIdAsStrFromUrl(preview.image.url));
    }

    const isFirstAttachmentVoiceMessage = finalAttachments?.[0]?.isVoiceMessage;
    if (isFirstAttachmentVoiceMessage) {
      attachments[0].flags = SignalService.AttachmentPointer.Flags.VOICE_MESSAGE;
    }

    window.log.info(
      `Upload of message data for message ${this.idForLogging()} is finished in ${
        Date.now() - start
      }ms. Attachments: ${attachments.map(m => m.url)}`
    );

    this.setAttachments(
      this.getAttachments()?.map((a: any, index: number) => ({ ...a, url: attachments[index].url }))
    );
    // Note: we don't care about the fileUrl/fileId of previews, only of attachments as they are displayed in the message info

    await this.commit();

    return {
      body,
      attachments,
      preview,
      quote: this.get('quote'),
      fileIdsToLink: uniq(fileIdsToLink),
    };
  }

  /**
   * Marks the message as deleted to show the author has deleted this message for everyone.
   * Sets isDeleted property to true. Set message body text to deletion placeholder for conversation list items.
   */
  public async markAsDeleted() {
    this.set({
      isDeleted: true,
      body: tr('deleteMessageDeletedGlobally'),
      quote: undefined,
      groupInvitation: undefined,
      dataExtractionNotification: undefined,
      hasAttachments: 0,
      hasFileAttachments: 0,
      hasVisualMediaAttachments: 0,
      attachments: undefined,
      preview: undefined,
      reacts: undefined,
      reactsIndex: undefined,
      callNotificationType: undefined,
      interactionNotification: undefined,
      reaction: undefined,
      messageRequestResponse: undefined,
    });
    // we can ignore the result of that markMessageReadNoCommit as it would only be used
    // to refresh the expiry of it(but it is already marked as "deleted", so we don't care)
    this.markMessageReadNoCommit(Date.now());
    await this.commit();
    // the line below makes sure that getNextExpiringMessage will find this message as expiring.
    // getNextExpiringMessage is used on app start to clean already expired messages which should have been removed already, but are not
    await this.setToExpire();
    await this.getConversation()?.refreshInMemoryDetails();
  }

  // One caller today: event handler for the 'Retry Send' entry on right click of a failed send message
  public async retrySend() {
    if (!ReduxOnionSelectors.isOnlineOutsideRedux()) {
      window?.log?.error('retrySend: Cannot retry since we are offline!');
      return null;
    }

    this.set({ errors: undefined, sent: false, sent_to: [] });
    await this.commit();
    try {
      const conversation: ConversationModel | undefined = this.getConversation();
      if (!conversation) {
        window?.log?.info(
          '[retrySend] Cannot retry send message, the corresponding conversation was not found.'
        );
        return null;
      }
      const { body, attachments, preview, quote, fileIdsToLink } = await this.uploadData();

      if (conversation.isOpenGroupV2()) {
        const openGroupParams: OpenGroupVisibleMessageParams = {
          identifier: this.id,
          createAtNetworkTimestamp: NetworkTime.now(),
          userProfile: await UserUtils.getOurProfile(),
          outgoingProMessageDetails: await UserUtils.getOutgoingProMessageDetails({
            utf16: body,
          }),
          body,
          attachments,
          preview: preview ? [preview] : [],
          quote,
        };
        const roomInfos = OpenGroupData.getV2OpenGroupRoom(conversation.id);
        if (!roomInfos) {
          throw new Error('[retrySend] Could not find roomInfos for this conversation');
        }

        const openGroupMessage = new OpenGroupVisibleMessage(openGroupParams);
        const openGroup = OpenGroupData.getV2OpenGroupRoom(conversation.id);

        return MessageQueue.use().sendToOpenGroupV2({
          message: openGroupMessage,
          roomInfos,
          blinded: roomHasBlindEnabled(openGroup),
          filesToLink: fileIdsToLink,
        });
      }

      const createAtNetworkTimestamp = NetworkTime.now();

      const chatParams: VisibleMessageParams = {
        identifier: this.id,
        body,
        createAtNetworkTimestamp,
        attachments,
        preview: preview ? [preview] : [],
        quote,
        userProfile: await UserUtils.getOurProfile(),
        outgoingProMessageDetails: await UserUtils.getOutgoingProMessageDetails({
          utf16: body,
        }),
        // Note: we should have the fields set on that object when we've added it to the DB.
        // We don't want to reuse the conversation setting, as it might change since this message was sent.
        expirationType: this.getExpirationType() || 'unknown',
        expireTimer: this.getExpireTimerSeconds(),
      };

      const chatMessage = new VisibleMessage(chatParams);

      // Special-case the self-send case - we send only a sync message
      if (conversation.isMe()) {
        return this.sendSyncMessageOnly(chatMessage);
      }

      if (conversation.isPrivate()) {
        return MessageQueue.use().sendToPubKey(
          PubKey.cast(conversation.id),
          chatMessage,
          SnodeNamespaces.Default
        );
      }

      // Here, the convo is neither an open group, a private convo or ourself. It can only be a closed group.
      // For a closed group, retry send only means trigger a send again to all recipients
      // as they are all polling from the same group swarm pubkey
      if (!conversation.isClosedGroup()) {
        throw new Error(
          '[retrySend] We should only end up with a closed group here. Anything else is an error'
        );
      }

      if (conversation.isClosedGroupV2()) {
        const groupV2VisibleMessage = new ClosedGroupV2VisibleMessage({
          destination: PubKey.cast(this.get('conversationId')).key as GroupPubkeyType,
          chatMessageParams: chatParams,
        });
        // we need the return await so that errors are caught in the catch {}
        return await MessageQueue.use().sendToGroupV2({
          message: groupV2VisibleMessage,
        });
      }

      // legacy groups are readonly
      return null;
    } catch (e: unknown) {
      if (e instanceof Error) {
        await this.saveErrors(e);
      }
      return null;
    }
  }

  public getConversation(): ConversationModel | undefined {
    // This needs to be an unsafe call, because this method is called during
    //   initial module setup. We may be in the middle of the initial fetch to
    //   the database.
    return ConvoHub.use().getUnsafe(this.getConversationId() as string);
  }

  public getConversationId(): string | undefined {
    return this.get('conversationId');
  }

  public getQuoteContact() {
    const quote = this.get('quote');
    if (!quote) {
      return null;
    }
    const { author } = quote;
    if (!author) {
      return null;
    }

    return ConvoHub.use().get(author);
  }

  public getSource() {
    if (this.isIncoming()) {
      return this.get('source');
    }

    return UserUtils.getOurPubKeyStrFromCache();
  }

  public setSource(source: string) {
    if (source === this.getSource()) {
      return;
    }
    this.setKey('source', source);
  }

  public setConversationId(convoId: string) {
    if (convoId === this.getConversationId()) {
      return;
    }
    this.setKey('conversationId', convoId);
  }

  public isOutgoing() {
    return this.get('type') === 'outgoing';
  }

  public hasErrors() {
    return lodashSize(this.get('errors')) > 0;
  }

  /**
   * Update the messageHash field of that message instance. Does not call commit()
   *
   * @param messageHash
   */
  public updateMessageHash(messageHash: string) {
    if (!messageHash) {
      window?.log?.error('Message hash not provided to update message hash');
    }
    if (this.get('messageHash') !== messageHash) {
      window?.log?.info(`updated message ${this.id} with hash: ${messageHash}`);

      this.set({
        messageHash,
      });
    }
  }

  public async sendSyncMessageOnly(contentMessage: ContentMessageNoProfile) {
    const now = NetworkTime.now();

    this.set({
      sent_to: [UserUtils.getOurPubKeyStrFromCache()],
      sent: true,
    });

    await this.commit();

    const content =
      contentMessage instanceof ContentMessageNoProfile
        ? contentMessage.contentProto()
        : contentMessage;
    await this.sendSyncMessage(content, now);
  }

  public async sendSyncMessage(content: SignalService.Content, sentTimestamp: number) {
    if (this.get('synced') || this.get('sentSync')) {
      return;
    }
    const { dataMessage, proMessage } = content;

    if (
      dataMessage &&
      (dataMessage.body?.length ||
        dataMessage.attachments?.length ||
        dataMessage.flags === SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE)
    ) {
      const conversation = this.getConversation();
      if (!conversation) {
        throw new Error('Cannot trigger syncMessage with unknown convo.');
      }

      const expireUpdate = await DisappearingMessages.checkForExpireUpdateInContentMessage(
        content,
        conversation,
        null
      );

      const syncMessage = buildSyncMessage(
        this.id,
        dataMessage satisfies SignalService.IDataMessage as SignalService.DataMessage,
        conversation.id,
        sentTimestamp,
        expireUpdate,
        proMessage as SignalService.ProMessage | null
      );

      if (syncMessage) {
        await MessageSender.sendSingleMessage({
          isSyncMessage: true,
          message: MessageUtils.toRawMessage(
            PubKey.cast(UserUtils.getOurPubKeyStrFromCache()),
            syncMessage,
            SnodeNamespaces.Default
          ),
          abortSignal: null,
        });
      }
    }

    this.set({ sentSync: true });
    await this.commit();
  }

  public async saveErrors(providedError: Error) {
    if (!(providedError instanceof Error)) {
      throw new Error('saveErrors expects a single error to be provided');
    }

    const errorStr = `${providedError.name} - "${providedError.message || 'unknown error message'}"`;
    window.log.info(`save message error to msg ${this.idForLogging()} with error:`, errorStr);

    this.set({ errors: errorStr });
    await this.commit();
  }

  public async commit(triggerUIUpdate = true) {
    if (!this.id) {
      throw new Error('A message always needs an id');
    }
    // because the saving to db calls _cleanData which mutates the field for cleaning, we need to save a copy
    const id = await Data.saveMessage(this.cloneAttributes());
    if (triggerUIUpdate) {
      this.dispatchMessageUpdate();
    }

    return id;
  }

  /**
   * Mark a message as read if it was not already read.
   * @param readAt the timestamp at which this message was read
   * @returns true if the message was marked as read, and if its expiry should be updated on the swarm, false otherwise
   */
  public markMessageReadNoCommit(readAt: number): boolean {
    if (!this.isUnread()) {
      return false;
    }

    this.set({ unread: READ_MESSAGE_STATE.read });

    const convo = this.getConversation();
    const canBeDeleteAfterRead = convo && !convo.isMe() && convo.isPrivate();
    const expirationType = this.getExpirationType();
    const expireTimer = this.getExpireTimerSeconds();

    if (canBeDeleteAfterRead && expirationType && expireTimer > 0) {
      const expirationMode = DisappearingMessages.changeToDisappearingConversationMode(
        convo,
        expirationType,
        expireTimer
      );

      if (expirationMode === 'deleteAfterRead') {
        if (this.isIncoming() && !this.isExpiring()) {
          // only if that message has not started to expire already, set its "start expiry".
          // this is because a message can have a expire start timestamp set when receiving it, if the convo volatile said that the message was read by another device.
          if (!this.getExpirationStartTimestamp()) {
            this.set({
              expirationStartTimestamp: DisappearingMessages.setExpirationStartTimestamp(
                expirationMode,
                readAt,
                'markMessageReadNoCommit',
                this.id
              ),
            });
            // return true, we want to update/refresh the real expiry of this message from the swarm
            return true;
          }
          // return true, we want to update/refresh the real expiry of this message from the swarm
          return true;
        }
      }
    }

    Notifications.clearByMessageId(this.id);
    return false;
  }

  public isExpiring() {
    return this.getExpireTimerSeconds() && this.getExpirationStartTimestamp();
  }

  public isExpired() {
    if (!this.isExpiring()) {
      return false;
    }
    const now = Date.now();
    const start = this.getExpirationStartTimestamp();
    if (!start) {
      return false;
    }
    const delta = this.getExpireTimerSeconds() * 1000;
    const msFromNow = start + delta - now;
    return msFromNow < 0;
  }

  public async setToExpire() {
    if (this.isExpiring() && !this.getExpiresAt()) {
      const start = this.getExpirationStartTimestamp();
      const delta = this.getExpireTimerSeconds() * 1000;
      if (!start) {
        return;
      }

      // NOTE we use the locally calculated TTL here until we get the server TTL response
      const expiresAt = start + delta;

      this.set({
        expires_at: expiresAt,
      });

      if (this.id) {
        await this.commit();
      }

      window?.log?.debug('Set message expiration', {
        expiresAt,
        sentAt: this.get('sent_at'),
      });
    }
  }

  public deleteAttributes(attrsToDelete: 'quote_attachments' | 'preview_image') {
    switch (attrsToDelete) {
      case 'quote_attachments':
        delete this.attributes.quote.attachments;
        break;

      case 'preview_image':
        delete this.attributes.preview[0].image;

        break;

      default:
        break;
    }
  }

  public setAttachments(attachments: Array<AttachmentTypeWithPath>) {
    if (isEqual(attachments, this.getAttachments())) {
      return;
    }
    this.set({ attachments });
  }

  public getAttachments() {
    return this.get('attachments');
  }

  public setPreview(preview: any) {
    if (isEqual(preview, this.getPreview())) {
      return;
    }
    this.set({ preview });
  }

  public getReacts() {
    return this.get('reacts');
  }

  public setReacts(reacts: ReactionList | undefined) {
    if (isEqual(reacts, this.getReacts())) {
      return;
    }
    this.set({ reacts });
  }

  public getReactsIndex() {
    return this.get('reactsIndex');
  }

  public setReactIndex(index: number) {
    if (this.getReactsIndex() === index) {
      return;
    }
    this.set({ reactsIndex: index });
  }

  public getQuote() {
    return this.get('quote');
  }

  public setQuote(quote: any) {
    if (isEqual(quote, this.getQuote())) {
      return;
    }
    this.set({ quote });
  }

  public getSentAt() {
    return this.get('sent_at');
  }

  public setSentAt(sentAt: number) {
    if (sentAt === this.getSentAt()) {
      return;
    }
    this.set({ sent_at: sentAt });
  }

  public setExpireTimer(expireTimerSeconds: number | undefined) {
    if (expireTimerSeconds === this.getExpireTimerSeconds()) {
      return;
    }
    this.set({ expireTimer: expireTimerSeconds });
  }

  /**
   * Exposed for convenience, but not recommended to use directly.
   */
  public set(attrs: Partial<MessageAttributes>) {
    super[privateSet](attrs);
    return this;
  }

  /**
   * Exposed for convenience, but not recommended to use directly.
   */
  public setKey<K extends keyof MessageAttributes>(
    key: K,
    value: MessageAttributes[K] | undefined
  ) {
    super[privateSetKey](key, value);
    return this;
  }

  public setExpirationType(expirationType: DisappearingMessageType | undefined) {
    if (expirationType === this.getExpirationType()) {
      return;
    }
    this.set({ expirationType });
  }

  public getMessageExpirationStartTimestamp() {
    return this.get('expirationStartTimestamp');
  }

  public setMessageExpirationStartTimestamp(expirationStartTimestamp: number | undefined) {
    if (expirationStartTimestamp === this.getMessageExpirationStartTimestamp()) {
      return;
    }
    this.set({ expirationStartTimestamp });
  }

  public setExpiresAt(expiresAt: number | undefined) {
    if (expiresAt === this.getExpiresAt()) {
      return;
    }
    this.set({ expires_at: expiresAt });
  }

  public getPreview() {
    return this.get('preview');
  }

  public isTrustedForAttachmentDownload() {
    try {
      const senderConvoId = this.getSource();
      const isClosedGroup = this.getConversation()?.isClosedGroup() || false;
      const isOpengroup = this.getConversation()?.isOpenGroupV2() || false;
      if (isOpengroup || isClosedGroup || isUsFromCache(senderConvoId)) {
        return true;
      }
      // check the convo from this user
      // we want the convo of the sender of this message
      const senderConvo = ConvoHub.use().get(senderConvoId);
      if (!senderConvo) {
        return false;
      }
      return senderConvo.get('isTrustedForAttachmentDownload') || false;
    } catch (e) {
      window.log.warn('isTrustedForAttachmentDownload: error; ', e.message);
      return false;
    }
  }

  private getProFeaturesUsed(): Array<ProMessageFeature> {
    if (!getFeatureFlag('proAvailable')) {
      return [];
    }

    const proProfileBitset = this.get('proProfileBitset');
    const proMessageBitset = this.get('proMessageBitset');
    if (!proProfileBitset && !proMessageBitset) {
      return [];
    }

    if (!isString(proProfileBitset) && !isString(proMessageBitset)) {
      return [];
    }

    return ProFeatures.proBitsetsToProFeatures({ proProfileBitset, proMessageBitset });
  }

  public setProFeaturesUsed({
    proProfileBitset,
    proMessageBitset,
  }: {
    proProfileBitset: bigint | null;
    proMessageBitset: bigint | null;
  }) {
    if (!getFeatureFlag('proAvailable')) {
      return false;
    }
    const proProfileStr = proProfileBitset ? proProfileBitset.toString() : undefined;
    const proMessageStr = proMessageBitset ? proMessageBitset.toString() : undefined;
    if (
      isEqual(proProfileBitset, this.get('proProfileBitset')) &&
      isEqual(proMessageStr, this.get('proMessageBitset'))
    ) {
      return false;
    }
    this.set({ proProfileBitset: proProfileStr });
    this.set({ proMessageBitset: proMessageStr });
    return true;
  }

  public async applyProFeatures(outgoingProMessageDetails: OutgoingProMessageDetails | null) {
    const proProfileBitset = this.get('proProfileBitset');
    const proMessageBitset = this.get('proMessageBitset');

    if (
      proProfileBitset ||
      proMessageBitset ||
      !outgoingProMessageDetails ||
      (!outgoingProMessageDetails.proMessageBitset && !outgoingProMessageDetails.proProfileBitset)
    ) {
      // if
      //  - We already have some bitset set for this message in the DB,
      //  - or the proMessageDetails is empty
      //  - or the proMessageDetails has no bitset set
      // then,
      // - we do not need to apply the bitset from the details.
      // - we also don't need the update the pro stats with this change (as we can assume the change was already counted).

      return;
    }
    const proDetails = outgoingProMessageDetails?.toProtobufDetails();
    // store the bitset that was used to send that message on the sending side too
    if (proDetails) {
      this.setProFeaturesUsed({
        proMessageBitset: longOrNumberToBigInt(proDetails.messageBitset),
        proProfileBitset: longOrNumberToBigInt(proDetails.profileBitset),
      });
      await this.commit();
      const proFeaturesUsed = this.getProFeaturesUsed();
      await Promise.all(
        proFeaturesUsed.map(async proFeature => {
          switch (proFeature) {
            case ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH:
              await Storage.increment(SettingsKey.proLongerMessagesSent);
              break;
            case ProMessageFeature.PRO_BADGE:
              await Storage.increment(SettingsKey.proBadgesSent);
              break;
            case ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE:
              // nothing to do for animated display picture
              break;

            default:
              assertUnreachable(proFeature, 'Unknown pro feature');
          }
        })
      );
    }
  }

  private dispatchMessageUpdate() {
    updatesToDispatch.set(this.id, this.getMessageModelProps());
    throttledAllMessagesDispatch();
  }

  private isGroupUpdate() {
    return !isEmpty(this.get('group_update'));
  }

  /**
   * A long time ago, group_update attributes could be just the string 'You' and not an array of pubkeys.
   * Using this method to get the group update makes sure than the joined, kicked, or left are always an array of string, or undefined.
   * This is legacy code, our joined, kicked, left, etc should have been saved as an Array for a long time now.
   */
  private getGroupUpdateAsArray() {
    const groupUpdate = this.get('group_update');
    if (!groupUpdate || isEmpty(groupUpdate)) {
      return undefined;
    }
    const forcedArrayUpdate: MessageGroupUpdate = {};

    forcedArrayUpdate.joined = Array.isArray(groupUpdate.joined)
      ? groupUpdate.joined
      : groupUpdate.joined
        ? [groupUpdate.joined]
        : undefined;

    forcedArrayUpdate.joinedWithHistory = Array.isArray(groupUpdate.joinedWithHistory)
      ? groupUpdate.joinedWithHistory
      : groupUpdate.joinedWithHistory
        ? [groupUpdate.joinedWithHistory]
        : undefined;

    forcedArrayUpdate.kicked = Array.isArray(groupUpdate.kicked)
      ? groupUpdate.kicked
      : groupUpdate.kicked
        ? [groupUpdate.kicked]
        : undefined;

    forcedArrayUpdate.promoted = Array.isArray(groupUpdate.promoted)
      ? groupUpdate.promoted
      : groupUpdate.promoted
        ? [groupUpdate.promoted]
        : undefined;

    forcedArrayUpdate.left = Array.isArray(groupUpdate.left)
      ? groupUpdate.left
      : groupUpdate.left
        ? [groupUpdate.left]
        : undefined;

    forcedArrayUpdate.name = groupUpdate.name;
    forcedArrayUpdate.avatarChange = groupUpdate.avatarChange;

    return forcedArrayUpdate;
  }

  // #region Start of getters
  public getExpirationType() {
    return this.get('expirationType');
  }

  /**
   *
   * @returns the expireTimer (in seconds) for this message
   */
  public getExpireTimerSeconds() {
    return this.get('expireTimer');
  }

  public getExpirationStartTimestamp() {
    return this.get('expirationStartTimestamp');
  }

  public getExpiresAt() {
    return this.get('expires_at');
  }

  public getMessageHash() {
    return this.get('messageHash');
  }

  public getExpirationTimerUpdate() {
    return this.get('expirationTimerUpdate');
  }

  // #endregion
}

const throttledAllMessagesDispatch = debounce(
  () => {
    if (updatesToDispatch.size === 0) {
      return;
    }
    window.inboxStore?.dispatch(messagesChanged([...updatesToDispatch.values()]));
    updatesToDispatch.clear();
  },
  500,
  { trailing: true, leading: true, maxWait: 1000 }
);

/**
 * With `throttledAllMessagesDispatch`, we batch refresh changed messages every XXXms.
 * Sometimes, a message is changed and then deleted quickly.
 * This can cause an issue because if the message is deleted, but the XXXms ticks after that,
 * the message will appear again in the redux store.
 * This is a mistake, and was usually fixed by reloading the corresponding conversation.
 * Well, this function should hopefully fix this issue.
 * Anytime we delete a message, we have to call it to "cancel scheduled refreshes"
 * @param messageIds the ids to cancel the dispatch of.
 */
export function cancelUpdatesToDispatch(messageIds: Array<string>) {
  for (let index = 0; index < messageIds.length; index++) {
    const messageId = messageIds[index];
    updatesToDispatch.delete(messageId);
  }
}

const updatesToDispatch: Map<string, MessageModelPropsWithoutConvoProps> = new Map();

export function findAndFormatContact(pubkey: string): FindAndFormatContactType {
  const contactModel = ConvoHub.use().get(pubkey);
  let profileName: string | null = null;
  let isMe = false;

  if (
    pubkey === UserUtils.getOurPubKeyStrFromCache() ||
    (pubkey && PubKey.isBlinded(pubkey) && isUsAnySogsFromCache(pubkey))
  ) {
    profileName = tr('you');
    isMe = true;
  } else {
    profileName = contactModel?.getNicknameOrRealUsername() || null;
  }

  return {
    pubkey,
    avatarPath: contactModel?.getProOrNotAvatarPath() || null,
    name: contactModel?.getRealSessionUsername() || null,
    profileName,
    isMe,
  };
}

export function processQuoteAttachment(attachment: any): QuotedAttachmentType {
  const { thumbnail } = attachment;
  const path = thumbnail && thumbnail.path && getAbsoluteAttachmentPath(thumbnail.path);
  const objectUrl = thumbnail && thumbnail.objectUrl;

  const thumbnailWithObjectUrl =
    !path && !objectUrl
      ? undefined
      : { ...(attachment.thumbnail || {}), objectUrl: path || objectUrl };

  return {
    ...attachment,
    isVoiceMessage: isVoiceMessage(attachment),
    thumbnail: thumbnailWithObjectUrl,
  };
}
