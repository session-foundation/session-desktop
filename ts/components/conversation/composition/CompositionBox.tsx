import _, { debounce, isEmpty } from 'lodash';

import { connect } from 'react-redux';
import styled from 'styled-components';

import { AbortController } from 'abort-controller';

import autoBind from 'auto-bind';
import { Component, createRef, RefObject, KeyboardEvent } from 'react';
import { FrequentlyUsed } from 'emoji-mart';
import * as MIME from '../../../types/MIME';
import { SessionEmojiPanel, StyledEmojiPanel } from '../SessionEmojiPanel';
import { SessionRecording } from '../SessionRecording';

import { SettingsKey } from '../../../data/settings-key';
import { showLinkSharingConfirmationModalDialog } from '../../../interactions/conversationInteractions';
import { ToastUtils } from '../../../session/utils';
import { ReduxConversationType } from '../../../state/ducks/conversations';
import { removeAllStagedAttachmentsInConversation } from '../../../state/ducks/stagedAttachments';
import { StateType } from '../../../state/reducer';
import { getQuotedMessage, getSelectedConversation } from '../../../state/selectors/conversations';
import {
  getIsSelectedBlocked,
  getSelectedCanWrite,
  getSelectedConversationKey,
  useSelectedConversationKey,
  useSelectedIsBlocked,
} from '../../../state/selectors/selectedConversation';
import { AttachmentType } from '../../../types/Attachment';
import { processNewAttachment } from '../../../types/MessageAttachment';
import { AttachmentUtil } from '../../../util';
import {
  StagedAttachmentImportedType,
  StagedPreviewImportedType,
} from '../../../util/attachment/attachmentsUtil';
import { Flex } from '../../basic/Flex';
import { getMediaPermissionsSettings } from '../../settings/SessionSettings';
import { getDraftForConversation, updateDraftForConversation } from '../SessionConversationDrafts';
import { SessionQuotedMessageComposition } from '../SessionQuotedMessageComposition';
import { SessionStagedLinkPreview } from '../SessionStagedLinkPreview';
import { StagedAttachmentList } from '../StagedAttachmentList';
import {
  AddStagedAttachmentButton,
  SendMessageButton,
  StartRecordingButton,
  ToggleEmojiButton,
} from './CompositionButtons';
import { CompositionTextArea } from './CompositionTextArea';
import { HTMLDirection } from '../../../util/i18n/rtlSupport';
import type { FixedBaseEmoji } from '../../../types/Reaction';
import { CharacterCount } from './CharacterCount';
import { Constants } from '../../../session';
import type { CompositionInputRef } from './CompositionInput';
import { useShowBlockUnblock } from '../../menuAndSettingsHooks/useShowBlockUnblock';
import { showLocalizedPopupDialog } from '../../dialog/LocalizedPopupDialog';
import { formatNumber } from '../../../util/i18n/formatting/generics';
import { getFeatureFlag } from '../../../state/ducks/types/releasedFeaturesReduxTypes';
import { showSessionCTA } from '../../dialog/SessionCTA';
import type { ProcessedLinkPreviewThumbnailType } from '../../../webworker/workers/node/image_processor/image_processor';
import { CTAVariant } from '../../dialog/cta/types';
import { selectWeAreProUser } from '../../../hooks/useHasPro';
import { closeContextMenus } from '../../../util/contextMenu';
import type { MessageAttributes } from '../../../models/messageType';
import { ProWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { updateOutgoingLightBoxOptions } from '../../../state/ducks/modalDialog';
import { isEnterKey, isEscapeKey } from '../../../util/keyboardShortcuts';

export interface ReplyingToMessageProps {
  convoId: string;
  id: string; // this is the quoted message timestamp
  author: string;
  timestamp: number;
  text?: string;
  attachments?: Array<any>;
}

export type StagedLinkPreviewData = {
  title: string | null;
  url: string | null;
  domain: string | null;
  scaledDown: ProcessedLinkPreviewThumbnailType | null;
};

export type StagedAttachmentType = AttachmentType & {
  file: File;
  path?: string; // a bit hacky, but this is the only way to make our sending audio message be playable, this must be used only for those message
};

export type SendMessageType = Pick<MessageAttributes, 'quote'> & {
  conversationId: string;
  body: string;
  attachments: Array<StagedAttachmentImportedType> | undefined;
  preview: Array<StagedPreviewImportedType> | undefined;
  groupInvitation: { url: string | undefined; name: string } | undefined;
};

interface Props {
  sendMessage: (msg: SendMessageType) => void;
  selectedConversationKey?: string;
  weAreProUser: boolean;
  selectedConversation: ReduxConversationType | undefined;
  typingEnabled: boolean;
  isBlocked: boolean;
  quotedMessageProps?: ReplyingToMessageProps;
  stagedAttachments: Array<StagedAttachmentType>;
  onChoseAttachments: (newAttachments: Array<File>) => void;
  htmlDirection: HTMLDirection;
}

interface State {
  showRecordingView: boolean;
  initialDraft: string;
  /**
   * This is an html draft (not a plain text draft. It contains html elements)
   */
  draft: string;
  showEmojiPanel: boolean;
  lastSelectedLength: number; // used for emoji panel replacement
  ignoredLink?: string; // set the ignored url when users closed the link preview
  stagedLinkPreview?: StagedLinkPreviewData;
}

const getDefaultState = (newConvoId?: string) => {
  const draft = getDraftForConversation(newConvoId);
  return {
    draft,
    initialDraft: draft,
    showRecordingView: false,
    showEmojiPanel: false,
    lastSelectedLength: 0,
    ignoredLink: undefined,
    stagedLinkPreview: undefined,
  };
};

const StyledEmojiPanelContainer = styled.div<{ dir?: HTMLDirection }>`
  ${StyledEmojiPanel} {
    position: absolute;
    bottom: 68px;
    ${props => (props.dir === 'rtl' ? 'left: 0px' : 'right: 0px;')}
  }
`;

const StyledSendMessageInput = styled.div<{ dir?: HTMLDirection }>`
  position: relative;
  cursor: text;
  display: flex;
  align-self: center;
  align-items: center;
  flex-grow: 1;
  ${props => props.dir === 'rtl' && 'margin-inline-start: var(--margins-sm);'}
  background-color: inherit;
  margin-top: var(--margins-xs);

  .mention-container {
    border-radius: var(--border-radius);
    box-shadow: rgba(0, 0, 0, 0.24) 0px 3px 8px;
    background-color: var(--suggestions-background-color);
    z-index: 3;
    min-width: 100px;

    ul {
      border-radius: var(--border-radius);
      max-height: 70vh;
      border: none;
      background: transparent;
      outline: none;
      padding: 0;
      margin: 0;
      overflow-x: hidden;
      overflow-y: auto;

      li {
        font-size: 14px;
        cursor: pointer;
        height: auto;
        padding-top: var(--margins-xs);
        padding-bottom: var(--margins-xs);
        background-color: var(--suggestions-background-color);
        color: var(--text-primary-color);
        transition: var(--default-duration);

        &:hover,
        &.selected-option {
          background-color: var(--suggestions-background-hover-color);
        }
      }
    }
  }
`;

const StyledCompositionContainer = styled.div`
  border-top: var(--default-borders);
  z-index: 1;
`;

const StyledRightCompositionBoxButtonContainer = styled.div`
  position: absolute;
  inset-inline-end: var(--margins-md);
  gap: var(--margins-sm);
  display: flex;
  flex-direction: row;
  width: max-content;
  z-index: 2;
`;

const StyledCompositionBoxContainer = styled(Flex)`
  position: relative;
  padding-inline-start: var(--margins-md);
  padding-inline-end: 0;
  padding-top: var(--margins-sm);
  padding-bottom: var(--margins-sm);
`;

class CompositionBoxInner extends Component<Props, State> {
  private readonly inputRef: RefObject<CompositionInputRef | null>;
  private readonly fileInput: RefObject<HTMLInputElement | null>;
  private container: RefObject<HTMLDivElement | null>;
  private readonly emojiPanel: RefObject<HTMLDivElement | null>;
  private readonly emojiPanelButton: any;
  private linkPreviewAbortController?: AbortController;

  constructor(props: Props) {
    super(props);
    this.state = getDefaultState(props.selectedConversationKey);

    this.inputRef = createRef();
    this.fileInput = createRef();
    this.container = createRef();

    // Emojis
    this.emojiPanel = createRef();
    this.emojiPanelButton = createRef();
    autoBind(this);
    this.toggleEmojiPanel = debounce(this.toggleEmojiPanel.bind(this), 100);
  }

  public componentDidMount() {
    setTimeout(this.focusCompositionBox, 500);
    if (this.container.current) {
      this.container.current.addEventListener('paste', this.handlePaste);
    }
  }

  public componentWillUnmount() {
    this.linkPreviewAbortController?.abort();
    this.linkPreviewAbortController = undefined;
    if (this.container.current) {
      this.container.current.removeEventListener('paste', this.handlePaste);
    }
  }

  public componentDidUpdate(prevProps: Props, _prevState: State) {
    // reset the state on new conversation key
    if (prevProps.selectedConversationKey !== this.props.selectedConversationKey) {
      this.setState(getDefaultState(this.props.selectedConversationKey), this.focusCompositionBox);
    } else if (this.props.stagedAttachments?.length !== prevProps.stagedAttachments?.length) {
      // if number of staged attachment changed, focus the composition box for a more natural UI
      this.focusCompositionBox();
    }

    // focus the composition box when user clicks start to reply to a message
    if (!_.isEqual(prevProps.quotedMessageProps, this.props.quotedMessageProps)) {
      this.focusCompositionBox();
    }
  }

  public render() {
    const { showRecordingView, draft } = this.state;
    const { typingEnabled, isBlocked, stagedAttachments, quotedMessageProps } = this.props;

    // we completely hide the composition box when typing is not enabled now.
    // Actually not anymore. We want the above, except when we can't write because that user is blocked.
    // When that user is blocked, **and only then**, we want to show the composition box, disabled with the placeholder "unblock to send".
    if (!typingEnabled && !isBlocked) {
      return null;
    }

    return (
      <Flex $flexDirection="column">
        <SessionQuotedMessageComposition />
        {
          // Don't render link previews if quoted message or attachments are already added
          stagedAttachments.length !== 0 || quotedMessageProps?.id ? null : (
            <SessionStagedLinkPreview
              draft={draft}
              setStagedLinkPreview={this.setStagedLinkPreview}
            />
          )
        }
        {this.renderAttachmentsStaged()}
        <StyledCompositionContainer>
          {showRecordingView ? this.renderRecordingView() : this.renderCompositionView()}
          <BlockedOverlayOnCompositionBox />
        </StyledCompositionContainer>
      </Flex>
    );
  }

  private handlePaste(e: ClipboardEvent) {
    if (!e.clipboardData) {
      return;
    }
    const { items } = e.clipboardData;
    let imgBlob = null;
    // eslint-disable-next-line no-restricted-syntax
    for (const item of items as any) {
      const pasteType = item.type.split('/')[0];
      if (pasteType === 'image') {
        imgBlob = item.getAsFile();
      }

      switch (pasteType) {
        case 'image':
          imgBlob = item.getAsFile();
          break;
        case 'text':
          void showLinkSharingConfirmationModalDialog(e.clipboardData.getData('text'));
          break;
        default:
      }
    }
    if (imgBlob !== null) {
      const file = imgBlob;
      window?.log?.info('Adding attachment from clipboard', file);
      this.props.onChoseAttachments([file]);

      e.preventDefault();
      e.stopPropagation();
    }
  }

  private showEmojiPanel() {
    this.setState({ lastSelectedLength: window.getSelection()?.toString().length ?? 0 });

    closeContextMenus();
    this.setState({
      showEmojiPanel: true,
    });
  }

  private hideEmojiPanel() {
    this.setState({ lastSelectedLength: 0 });

    this.setState({
      showEmojiPanel: false,
    });

    this.focusCompositionBox();
  }

  private setDraft(draft: string) {
    this.setState({ draft });
  }

  private setStagedLinkPreview(linkPreview: StagedLinkPreviewData) {
    this.setState({ stagedLinkPreview: linkPreview });
  }

  private toggleEmojiPanel() {
    if (this.state.showEmojiPanel) {
      this.hideEmojiPanel();
    } else {
      this.showEmojiPanel();
    }
  }

  private renderRecordingView() {
    return (
      <SessionRecording
        sendVoiceMessage={this.sendVoiceMessage}
        onLoadVoiceNoteView={this.onLoadVoiceNoteView}
        onExitVoiceNoteView={this.onExitVoiceNoteView}
      />
    );
  }

  private renderCompositionView() {
    const { showEmojiPanel } = this.state;
    const { typingEnabled, isBlocked } = this.props;

    // we can only send a message if the conversation allows writing in it AND
    // - we've got a message body OR
    // - we've got a staged attachments
    const showSendButton =
      typingEnabled && (this.isTextSendable() || !isEmpty(this.props.stagedAttachments));

    /* eslint-disable @typescript-eslint/no-misused-promises */

    // we completely hide the composition box when typing is not enabled now.
    // Actually not anymore. We want the above, except when we can't write because that user is blocked.
    // When that user is blocked, **and only then**, we want to show the composition box, disabled with the placeholder "unblock to send", and the buttons disabled.
    // A click on the composition box should bring the "unblock user" dialog.
    if (!typingEnabled && !isBlocked) {
      return null;
    }

    return (
      <StyledCompositionBoxContainer
        dir={this.props.htmlDirection}
        $container={true}
        $flexDirection="row"
        $alignItems="flex-end"
        width="100%"
        onClick={this.focusCompositionBox} // used to focus on the textarea when clicking in its container
        $flexGap="var(--margins-xs)"
      >
        {typingEnabled || isBlocked ? (
          <AddStagedAttachmentButton onClick={this.onChooseAttachment} />
        ) : null}
        <input
          className="hidden"
          placeholder="Attachment"
          multiple={true}
          ref={this.fileInput}
          type="file"
          onChange={this.onChoseAttachment}
        />
        <StyledSendMessageInput role="main" dir={this.props.htmlDirection} ref={this.container}>
          <CompositionTextArea
            draft={this.state.draft}
            initialDraft={this.state.initialDraft}
            setDraft={this.setDraft}
            container={this.container}
            inputRef={this.inputRef}
            typingEnabled={this.props.typingEnabled}
            onKeyDown={this.onKeyDown}
          />
        </StyledSendMessageInput>
        <StyledRightCompositionBoxButtonContainer>
          {typingEnabled && (
            <ToggleEmojiButton ref={this.emojiPanelButton} onClick={this.toggleEmojiPanel} />
          )}
          {showSendButton ? (
            <SendMessageButton onClick={this.onSendMessage} />
          ) : (
            <StartRecordingButton onClick={this.onLoadVoiceNoteView} />
          )}
        </StyledRightCompositionBoxButtonContainer>
        {showEmojiPanel ? (
          <StyledEmojiPanelContainer role="button" dir={this.props.htmlDirection}>
            <SessionEmojiPanel
              ref={this.emojiPanel}
              onEmojiClicked={this.onEmojiClick}
              onClose={this.hideEmojiPanel}
              show={showEmojiPanel}
            />
          </StyledEmojiPanelContainer>
        ) : null}
        <CharacterCount text={this.getSendableTextFromDraft()} />
      </StyledCompositionBoxContainer>
    );
  }

  private onClickAttachment(attachment: AttachmentType) {
    const stagedAttachment = this.props.stagedAttachments.find(a => a.url === attachment.url);
    // For JPEG images, attachment.url is a low-quality thumbnail.
    // Use the original file to get the full-quality image for the lightbox.
    const fullUrl =
      attachment.videoUrl ||
      (stagedAttachment?.file ? URL.createObjectURL(stagedAttachment.file) : attachment.url);

    window.inboxStore?.dispatch(
      updateOutgoingLightBoxOptions({
        attachment,
        url: fullUrl,
        onClose: () => {
          if (stagedAttachment?.file && fullUrl !== attachment.url) {
            URL.revokeObjectURL(fullUrl);
          }
          window.inboxStore?.dispatch(updateOutgoingLightBoxOptions(null));
        },
      })
    );
  }

  private renderAttachmentsStaged() {
    const { stagedAttachments } = this.props;
    if (stagedAttachments && stagedAttachments.length) {
      return (
        <StagedAttachmentList
          attachments={stagedAttachments}
          onClickAttachment={this.onClickAttachment}
          onAddAttachment={this.onChooseAttachment}
        />
      );
    }
    return null;
  }

  private onChooseAttachment() {
    if (
      !this.props.selectedConversation?.didApproveMe &&
      this.props.selectedConversation?.isPrivate
    ) {
      ToastUtils.pushNoMediaUntilApproved();
      return;
    }
    this.fileInput.current?.click();
  }

  private async onChoseAttachment() {
    // Build attachments list
    let attachmentsFileList = null;

    // this is terrible, but we have to reset the input value manually.
    // otherwise, the user won't be able to select two times the same file for example.
    if (this.fileInput.current?.files) {
      attachmentsFileList = Array.from(this.fileInput.current.files);
      this.fileInput.current.files = null;
      this.fileInput.current.value = '';
    }
    if (!attachmentsFileList || attachmentsFileList.length === 0) {
      return;
    }
    this.props.onChoseAttachments(attachmentsFileList);
  }

  /**
   * This onKeyDown method is called conditionally by the composition input.
   * If the input is in mentioning mode, this **will NOT** be called.
   * @param event - Keyboard event.
   */
  private async onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isEscapeKey(event) && this.state.showEmojiPanel) {
      this.hideEmojiPanel();
      return;
    }
    if (event.key === 'e' && (event.ctrlKey || event.metaKey)) {
      this.toggleEmojiPanel();
      return;
    }
    const isShiftSendEnabled = !!window.getSettingValue(SettingsKey.hasShiftSendEnabled);
    if (
      !event.nativeEvent.isComposing &&
      isEnterKey(event) &&
      isShiftSendEnabled === event.shiftKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      await this.onSendMessage();
    }

    // TODO: fix the bug with the pageup/down keys popping out the right panel when the box has text in it.
    if (this.state.draft.length && (event.key === 'PageUp' || event.key === 'PageDown')) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.state.draft.length && (event.key === 'Home' || event.key === 'End')) {
      event.stopPropagation();
    }
  }

  /**
   * Our draft contains html elements to render mentions and custom actions.
   * Before sending and to check the character count, we need to remove those html elements and replace those with
   * the correct content.
   * This is what this function does.
   */
  private getSendableTextFromDraft(): string {
    const { draft } = this.state;
    const doc = new DOMParser().parseFromString(`<div>${draft}</div>`, 'text/html');
    doc.querySelectorAll('span[data-user-id]').forEach(span => {
      const id = span.getAttribute('data-user-id');
      // eslint-disable-next-line no-param-reassign
      span.textContent = id ? `@${id}` : span.textContent;
    });
    const cleaned = doc.body.textContent?.trim().replace(/^\n+|\n+$/g, '') ?? '';
    return cleaned;
  }

  private isTextSendable() {
    const text = this.getSendableTextFromDraft();
    return text.length > 0;
  }

  private async onSendMessage() {
    const {
      selectedConversationKey,
      selectedConversation,
      stagedAttachments,
      quotedMessageProps,
      weAreProUser: hasPro,
    } = this.props;

    const { stagedLinkPreview } = this.state;

    if (!selectedConversationKey) {
      throw new Error('selectedConversationKey is needed');
    }

    if (!selectedConversation) {
      return;
    }

    this.linkPreviewAbortController?.abort();

    const isProAvailable = getFeatureFlag('proAvailable');

    const charLimit = hasPro
      ? Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_PRO
      : Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_STANDARD;

    const text = this.getSendableTextFromDraft();

    const { codepointCount } = await ProWrapperActions.utf16Count({ utf16: text });

    if (codepointCount > charLimit) {
      const dispatch = window.inboxStore?.dispatch;
      if (dispatch) {
        if (isProAvailable && !hasPro) {
          showSessionCTA(CTAVariant.PRO_MESSAGE_CHARACTER_LIMIT, dispatch);
        } else {
          showLocalizedPopupDialog(
            {
              title: {
                token: 'modalMessageTooLongTitle',
              },
              description: {
                token: 'modalMessageTooLongDescription',
                limit: formatNumber(charLimit),
              },
            },
            dispatch
          );
        }
      }
      return;
    }

    if (selectedConversation.isBlocked) {
      ToastUtils.pushUnblockToSend();
      return;
    }
    // Verify message length
    const msgLen = text?.length || 0;
    if (msgLen === 0 && stagedAttachments?.length === 0) {
      return;
    }

    if (!selectedConversation.isPrivate && selectedConversation.isKickedFromGroup) {
      ToastUtils.pushYouLeftTheGroup();
      return;
    }

    // Send message

    // we consider that a link preview without a title at least is not a preview
    const linkPreview =
      stagedLinkPreview && stagedLinkPreview.title?.length
        ? _.pick(stagedLinkPreview, 'url', 'scaledDown', 'title')
        : undefined;

    try {
      const { attachments, previews } = await this.getFiles(linkPreview, stagedAttachments);

      this.props.sendMessage({
        conversationId: selectedConversationKey,
        body: text.trim(),
        attachments: attachments || [],
        quote: quotedMessageProps
          ? { author: quotedMessageProps.author, timestamp: quotedMessageProps.timestamp }
          : undefined,
        preview: previews,
        groupInvitation: undefined,
      });

      window.inboxStore?.dispatch(
        removeAllStagedAttachmentsInConversation({
          conversationId: selectedConversationKey,
        })
      );
      // Empty composition box and stagedAttachments
      this.setState({
        showEmojiPanel: false,
        stagedLinkPreview: undefined,
        ignoredLink: undefined,
        draft: '',
      });
      updateDraftForConversation({
        conversationKey: selectedConversationKey,
        draft: '',
      });
    } catch (e) {
      // Message sending failed
      window?.log?.error(e);
    }
  }

  // This function is called right before sending a message, to gather really the
  // files content behind the staged attachments.
  private async getFiles(
    linkPreview?: Pick<StagedLinkPreviewData, 'url' | 'title' | 'scaledDown'>,
    stagedAttachments: Array<StagedAttachmentType> = []
  ): Promise<{
    attachments: Array<StagedAttachmentImportedType>;
    previews: Array<StagedPreviewImportedType>;
  }> {
    let attachments: Array<StagedAttachmentImportedType> = [];
    let previews: Array<StagedPreviewImportedType> = [];

    if (_.isEmpty(stagedAttachments)) {
      attachments = [];
    } else {
      // scale them down
      const files = await Promise.all(stagedAttachments.map(AttachmentUtil.getFileAndStoreLocally));
      attachments = _.compact(files);
    }

    if (!linkPreview || _.isEmpty(linkPreview) || !linkPreview.url || !linkPreview.title) {
      previews = [];
    } else {
      const sharedDetails = { url: linkPreview.url, title: linkPreview.title };
      previews = [sharedDetails];
      // store the first image preview locally and get the path and details back to include them in the message
      if (linkPreview.scaledDown && !isEmpty(linkPreview.scaledDown)) {
        const storedLinkPreviewAttachment = await AttachmentUtil.getFileAndStoreLocallyImageBlob(
          linkPreview.scaledDown
        );
        if (storedLinkPreviewAttachment) {
          previews = [{ ...sharedDetails, image: storedLinkPreviewAttachment }];
        }
      }
    }

    return { attachments, previews };
  }

  private async sendVoiceMessage(audioBlob: Blob) {
    const { selectedConversationKey } = this.props;
    if (!this.state.showRecordingView || !selectedConversationKey) {
      return;
    }

    const savedAudioFile = await processNewAttachment({
      data: await audioBlob.arrayBuffer(),
      isRaw: true,
      contentType: MIME.AUDIO_MP3,
    });
    // { ...savedAudioFile, path: savedAudioFile.path },
    const audioAttachment: StagedAttachmentType = {
      file: new File([], 'session-audio-message'), // this is just to emulate a file for the staged attachment type of that audio file
      contentType: MIME.AUDIO_MP3,
      size: savedAudioFile.size,
      fileSize: null,
      screenshot: null,
      fileName: 'session-audio-message',
      thumbnail: null,
      url: '',
      isVoiceMessage: true,
      path: savedAudioFile.path,
    };

    this.props.sendMessage({
      conversationId: selectedConversationKey,
      body: '',
      attachments: [audioAttachment],
      preview: undefined,
      quote: undefined,
      groupInvitation: undefined,
    });

    this.onExitVoiceNoteView();
  }

  private onLoadVoiceNoteView() {
    if (!getMediaPermissionsSettings()) {
      ToastUtils.pushAudioPermissionNeeded();
      return;
    }
    this.setState({
      showRecordingView: true,
      showEmojiPanel: false,
    });
  }

  private onExitVoiceNoteView() {
    this.setState({ showRecordingView: false });
  }

  private onEmojiClick(emoji: FixedBaseEmoji) {
    if (emoji.native) {
      FrequentlyUsed.add(emoji);
      this.inputRef.current?.typeAtCaret(emoji.native, 0, this.state.lastSelectedLength);
      this.setState({ lastSelectedLength: 0 });
    }
  }

  private focusCompositionBox() {
    this.inputRef.current?.focus();
  }
}

const mapStateToProps = (state: StateType) => {
  return {
    quotedMessageProps: getQuotedMessage(state),
    selectedConversation: getSelectedConversation(state),
    weAreProUser: selectWeAreProUser(state),
    selectedConversationKey: getSelectedConversationKey(state),
    typingEnabled: getSelectedCanWrite(state),
    isBlocked: getIsSelectedBlocked(state),
  };
};

const smart = connect(mapStateToProps);

export const CompositionBox = smart(CompositionBoxInner);

const StyledBlockedOverlayOnCompositionBox = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  background-color: transparent;
  cursor: pointer;
`;

/**
 * Note: This component is to be removed once we get the updated composition box PR merged.
 * It is only used to hijack the clicks on the composition box and display the "unblock user dialog",
 * when that user is currently blocked.
 * The reason it was easier to do it this way is because the buttons of the composition box do not react
 * to click events when they are disabled.
 *
 * Note2: Actually having this component offer the unblock user dialog on click right away is convenient as a UX.
 * Maybe we should keep it?
 */
function BlockedOverlayOnCompositionBox() {
  const selectedConvoKey = useSelectedConversationKey();
  const isBlocked = useSelectedIsBlocked();
  const blockUnblockCb = useShowBlockUnblock(selectedConvoKey);

  if (!isBlocked) {
    return null;
  }

  return <StyledBlockedOverlayOnCompositionBox onClick={blockUnblockCb?.cb} />;
}
