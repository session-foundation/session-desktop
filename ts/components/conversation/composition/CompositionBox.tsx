import _, { debounce, isEmpty } from 'lodash';

import { connect } from 'react-redux';
import styled from 'styled-components';

import { AbortController } from 'abort-controller';

import autoBind from 'auto-bind';
import { Component, RefObject, createRef } from 'react';
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
} from '../../../util/attachmentsUtil';
import { LinkPreviews } from '../../../util/linkPreviews';
import { CaptionEditor } from '../../CaptionEditor';
import { Flex } from '../../basic/Flex';
import { getMediaPermissionsSettings } from '../../settings/SessionSettings';
import { getDraftForConversation, updateDraftForConversation } from '../SessionConversationDrafts';
import { SessionQuotedMessageComposition } from '../SessionQuotedMessageComposition';
import {
  LINK_PREVIEW_TIMEOUT,
  SessionStagedLinkPreview,
  getPreview,
} from '../SessionStagedLinkPreview';
import { StagedAttachmentList } from '../StagedAttachmentList';
import {
  AddStagedAttachmentButton,
  SendMessageButton,
  StartRecordingButton,
  ToggleEmojiButton,
} from './CompositionButtons';
import { CompositionTextArea } from './CompositionTextArea';
import { cleanMentions, mentionsRegex } from './UserMentions';
import { HTMLDirection } from '../../../util/i18n/rtlSupport';
import type { FixedBaseEmoji } from '../../../types/Reaction';
import { useShowBlockUnblock } from '../../menuAndSettingsHooks/useShowBlockUnblock';

export interface ReplyingToMessageProps {
  convoId: string;
  id: string; // this is the quoted message timestamp
  author: string;
  timestamp: number;
  text?: string;
  attachments?: Array<any>;
}

export type StagedLinkPreviewImage = {
  data: ArrayBuffer;
  size: number;
  width: number;
  height: number;
  contentType: string;
};

export interface StagedLinkPreviewData {
  isLoaded: boolean;
  title: string | null;
  url: string | null;
  domain: string | null;
  image?: StagedLinkPreviewImage;
}

export interface StagedAttachmentType extends AttachmentType {
  file: File;
  path?: string; // a bit hacky, but this is the only way to make our sending audio message be playable, this must be used only for those message
}

export type SendMessageType = {
  body: string;
  attachments: Array<StagedAttachmentImportedType> | undefined;
  quote: any | undefined;
  preview: any | undefined;
  groupInvitation: { url: string | undefined; name: string } | undefined;
};

interface Props {
  sendMessage: (msg: SendMessageType) => void;
  selectedConversationKey?: string;
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
  draft: string;
  showEmojiPanel: boolean;
  ignoredLink?: string; // set the ignored url when users closed the link preview
  stagedLinkPreview?: StagedLinkPreviewData;
  showCaptionEditor?: AttachmentType;
}

const getDefaultState = (newConvoId?: string) => {
  return {
    draft: getDraftForConversation(newConvoId),
    showRecordingView: false,
    showEmojiPanel: false,
    ignoredLink: undefined,
    stagedLinkPreview: undefined,
    showCaptionEditor: undefined,
  };
};

const getSelectionBasedOnMentions = (draft: string, index: number) => {
  // we have to get the real selectionStart/end of an index in the mentions box.
  // this is kind of a pain as the mentions box has two inputs, one with the real text, and one with the extracted mentions

  // the index shown to the user is actually just the visible part of the mentions (so the part between ￗ...ￒ
  const matches = draft.match(mentionsRegex);

  let lastMatchStartIndex = 0;
  let lastMatchEndIndex = 0;
  let lastRealMatchEndIndex = 0;

  if (!matches) {
    return index;
  }
  const mapStartToLengthOfMatches = matches.map(match => {
    const displayNameStart = match.indexOf('\uFFD7') + 1;
    const displayNameEnd = match.lastIndexOf('\uFFD2');
    const displayName = match.substring(displayNameStart, displayNameEnd);

    const currentMatchStartIndex = draft.indexOf(match) + lastMatchStartIndex;
    lastMatchStartIndex = currentMatchStartIndex;
    lastMatchEndIndex = currentMatchStartIndex + match.length;

    const realLength = displayName.length + 1;
    lastRealMatchEndIndex += realLength;

    // the +1 is for the @
    return {
      length: displayName.length + 1,
      lastRealMatchEndIndex,
      start: lastMatchStartIndex,
      end: lastMatchEndIndex,
    };
  });

  const beforeFirstMatch = index < mapStartToLengthOfMatches[0].start;
  if (beforeFirstMatch) {
    // those first char are always just char, so the mentions logic does not come into account
    return index;
  }
  const lastMatchMap = _.last(mapStartToLengthOfMatches);

  if (!lastMatchMap) {
    return Number.MAX_SAFE_INTEGER;
  }

  const indexIsAfterEndOfLastMatch = lastMatchMap.lastRealMatchEndIndex <= index;
  if (indexIsAfterEndOfLastMatch) {
    const lastEnd = lastMatchMap.end;
    const diffBetweenEndAndLastRealEnd = index - lastMatchMap.lastRealMatchEndIndex;
    return lastEnd + diffBetweenEndAndLastRealEnd - 1;
  }
  // now this is the hard part, the cursor is currently between the end of the first match and the start of the last match
  // for now, just append it to the end
  return Number.MAX_SAFE_INTEGER;
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
  align-items: center;
  flex-grow: 1;
  min-height: var(--composition-container-height);
  padding: var(--margins-xs) 0;
  ${props => props.dir === 'rtl' && 'margin-inline-start: var(--margins-sm);'}
  z-index: 1;
  background-color: inherit;

  ul {
    max-height: 70vh;
    overflow: auto;
  }

  textarea {
    font-family: var(--font-default);
    min-height: calc(var(--composition-container-height) / 3);
    max-height: calc(3 * var(--composition-container-height));
    margin-right: var(--margins-md);
    color: var(--text-color-primary);

    background: transparent;
    resize: none;
    display: flex;
    flex-grow: 1;
    outline: none;
    border: none;
    font-size: 14px;
    line-height: var(--font-size-h2);
    letter-spacing: 0.5px;
  }

  &__emoji-overlay {
    // Should have identical properties to the textarea above to line up perfectly.
    position: absolute;
    font-size: 14px;
    font-family: var(--font-default);
    margin-left: 2px;
    line-height: var(--font-size-h2);
    letter-spacing: 0.5px;
    color: var(--transparent-color);
  }
`;

class CompositionBoxInner extends Component<Props, State> {
  private readonly textarea: RefObject<any>;
  private readonly fileInput: RefObject<HTMLInputElement>;
  private container: RefObject<HTMLDivElement>;
  private readonly emojiPanel: RefObject<HTMLDivElement>;
  private readonly emojiPanelButton: any;
  private linkPreviewAbortController?: AbortController;

  constructor(props: Props) {
    super(props);
    this.state = getDefaultState(props.selectedConversationKey);

    this.textarea = createRef();
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
    const { showRecordingView } = this.state;

    return (
      <Flex $flexDirection="column">
        <SessionQuotedMessageComposition />
        {this.renderStagedLinkPreview()}
        {this.renderAttachmentsStaged()}
        <div className="composition-container">
          {showRecordingView ? this.renderRecordingView() : this.renderCompositionView()}
          <BlockedOverlayOnCompositionBox />
        </div>
      </Flex>
    );
  }

  private handleClick(e: any) {
    if (
      (this.emojiPanel?.current && this.emojiPanel.current.contains(e.target)) ||
      (this.emojiPanelButton?.current && this.emojiPanelButton.current.contains(e.target))
    ) {
      return;
    }

    this.hideEmojiPanel();
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
          void showLinkSharingConfirmationModalDialog(e);
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
    document.addEventListener('mousedown', this.handleClick, false);

    this.setState({
      showEmojiPanel: true,
    });
  }

  private hideEmojiPanel() {
    document.removeEventListener('mousedown', this.handleClick, false);

    this.setState({
      showEmojiPanel: false,
    });
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
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
      typingEnabled && (!isEmpty(this.state.draft) || !isEmpty(this.props.stagedAttachments));

    /* eslint-disable @typescript-eslint/no-misused-promises */

    // we completely hide the composition box when typing is not enabled now.
    // Actually not anymore. We want the above, except when we can't write because that user is blocked.
    // When that user is blocked, **and only then**, we want to show the composition box, disabled with the placeholder "unblock to send", and the buttons disabled.
    // A click on the composition box should bring the "unblock user" dialog.
    if (!typingEnabled && !isBlocked) {
      return null;
    }

    return (
      <Flex
        dir={this.props.htmlDirection}
        $container={true}
        $flexDirection={'row'}
        $alignItems={'center'}
        width={'100%'}
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
        {typingEnabled || isBlocked ? (
          <StartRecordingButton onClick={this.onLoadVoiceNoteView} />
        ) : null}
        <StyledSendMessageInput
          role="main"
          dir={this.props.htmlDirection}
          onClick={this.focusCompositionBox} // used to focus on the textarea when clicking in its container
          ref={this.container}
          data-testid="message-input"
        >
          <CompositionTextArea
            draft={this.state.draft}
            setDraft={newDraft => {
              this.setState({ draft: newDraft });
            }}
            container={this.container}
            textAreaRef={this.textarea}
            typingEnabled={this.props.typingEnabled}
            onKeyDown={this.onKeyDown}
          />
        </StyledSendMessageInput>
        {typingEnabled && (
          <ToggleEmojiButton ref={this.emojiPanelButton} onClick={this.toggleEmojiPanel} />
        )}
        {showSendButton && <SendMessageButton onClick={this.onSendMessage} />}
        {showEmojiPanel && (
          <StyledEmojiPanelContainer role="button" dir={this.props.htmlDirection}>
            <SessionEmojiPanel
              ref={this.emojiPanel}
              show={showEmojiPanel}
              onEmojiClicked={this.onEmojiClick}
              onKeyDown={this.onKeyDown}
            />
          </StyledEmojiPanelContainer>
        )}
      </Flex>
    );
  }
  private renderStagedLinkPreview(): JSX.Element | null {
    // Don't generate link previews if user has turned them off
    if (!(window.getSettingValue(SettingsKey.settingsLinkPreview) || false)) {
      return null;
    }

    const { stagedAttachments, quotedMessageProps } = this.props;
    const { ignoredLink } = this.state;

    // Don't render link previews if quoted message or attachments are already added
    if (stagedAttachments.length !== 0 || quotedMessageProps?.id) {
      return null;
    }
    // we try to match the first link found in the current message
    const links = LinkPreviews.findLinks(this.state.draft, undefined);
    if (!links || links.length === 0 || ignoredLink === links[0]) {
      if (this.state.stagedLinkPreview) {
        this.setState({
          stagedLinkPreview: undefined,
        });
      }
      return null;
    }
    const firstLink = links[0];
    // if the first link changed, reset the ignored link so that the preview is generated
    if (ignoredLink && ignoredLink !== firstLink) {
      this.setState({ ignoredLink: undefined });
    }
    if (firstLink !== this.state.stagedLinkPreview?.url) {
      // trigger fetching of link preview data and image
      this.fetchLinkPreview(firstLink);
    }

    // if the fetch did not start yet, just don't show anything
    if (!this.state.stagedLinkPreview) {
      return null;
    }

    const { isLoaded, title, domain, image } = this.state.stagedLinkPreview;

    return (
      <SessionStagedLinkPreview
        isLoaded={isLoaded}
        title={title}
        domain={domain}
        image={image}
        url={firstLink}
        onClose={url => {
          this.setState({ ignoredLink: url });
        }}
      />
    );
  }

  private fetchLinkPreview(firstLink: string) {
    // mark the link preview as loading, no data are set yet
    this.setState({
      stagedLinkPreview: {
        isLoaded: false,
        url: firstLink,
        domain: null,
        image: undefined,
        title: null,
      },
    });
    const abortController = new AbortController();
    this.linkPreviewAbortController?.abort();
    this.linkPreviewAbortController = abortController;
    setTimeout(() => {
      abortController.abort();
    }, LINK_PREVIEW_TIMEOUT);

    // eslint-disable-next-line more/no-then
    getPreview(firstLink, abortController.signal)
      .then(ret => {
        // we finished loading the preview, and checking the abortController, we are still not aborted.
        // => update the staged preview
        if (this.linkPreviewAbortController && !this.linkPreviewAbortController.signal.aborted) {
          this.setState({
            stagedLinkPreview: {
              isLoaded: true,
              title: ret?.title || null,
              url: ret?.url || null,
              domain: (ret?.url && LinkPreviews.getDomain(ret.url)) || '',
              image: ret?.image,
            },
          });
        } else if (this.linkPreviewAbortController) {
          this.setState({
            stagedLinkPreview: {
              isLoaded: false,
              title: null,
              url: null,
              domain: null,
              image: undefined,
            },
          });
          this.linkPreviewAbortController = undefined;
        }
      })
      .catch(err => {
        window?.log?.warn('fetch link preview: ', err);
        const aborted = this.linkPreviewAbortController?.signal.aborted;
        this.linkPreviewAbortController = undefined;
        // if we were aborted, it either means the UI was unmount, or more probably,
        // than the message was sent without the link preview.
        // So be sure to reset the staged link preview so it is not sent with the next message.

        // if we were not aborted, it's probably just an error on the fetch. Nothing to do except mark the fetch as done (with errors)

        if (aborted) {
          this.setState({
            stagedLinkPreview: undefined,
          });
        } else {
          this.setState({
            stagedLinkPreview: {
              isLoaded: true,
              title: null,
              url: firstLink,
              domain: null,
              image: undefined,
            },
          });
        }
      });
  }

  private onClickAttachment(attachment: AttachmentType) {
    this.setState({ showCaptionEditor: attachment });
  }

  private renderCaptionEditor(attachment?: AttachmentType) {
    if (attachment) {
      const onSave = (caption: string) => {
        // eslint-disable-next-line no-param-reassign
        attachment.caption = caption;
        ToastUtils.pushToastInfo('saved', window.i18n.stripped('saved'));
        // close the light box on save
        this.setState({
          showCaptionEditor: undefined,
        });
      };

      const url = attachment.videoUrl || attachment.url;
      return (
        <CaptionEditor
          attachment={attachment}
          url={url}
          onSave={onSave}
          caption={attachment.caption}
          onClose={() => {
            this.setState({
              showCaptionEditor: undefined,
            });
          }}
        />
      );
    }
    return null;
  }

  private renderAttachmentsStaged() {
    const { stagedAttachments } = this.props;
    const { showCaptionEditor } = this.state;
    if (stagedAttachments && stagedAttachments.length) {
      return (
        <>
          <StagedAttachmentList
            attachments={stagedAttachments}
            onClickAttachment={this.onClickAttachment}
            onAddAttachment={this.onChooseAttachment}
          />
          {this.renderCaptionEditor(showCaptionEditor)}
        </>
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

  private async onKeyDown(event: any) {
    const isEnter = event.key === 'Enter';
    const isShiftEnter = event.shiftKey && isEnter;
    const isShiftSendEnabled = window.getSettingValue(SettingsKey.hasShiftSendEnabled) as boolean;
    const isNotComposing = !event.nativeEvent.isComposing;

    if (isShiftSendEnabled && isEnter && isNotComposing) {
      event.preventDefault();
      if (isShiftEnter) {
        await this.onSendMessage();
      } else {
        this.insertNewLine();
      }
    } else if (isEnter && !event.shiftKey && isNotComposing) {
      event.preventDefault();
      await this.onSendMessage();
    } else if (event.key === 'Escape' && this.state.showEmojiPanel) {
      this.hideEmojiPanel();
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      // swallow pageUp events if they occurs on the composition box (it breaks the app layout)
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private insertNewLine() {
    const messageBox = this.textarea.current;
    if (!messageBox) {
      return;
    }

    const { draft } = this.state;
    const { selectedConversationKey } = this.props;

    if (!selectedConversationKey) {
      return; // add this check to prevent undefined from being used
    }

    const currentSelectionStart = Number(messageBox.selectionStart);
    const realSelectionStart = getSelectionBasedOnMentions(draft, currentSelectionStart);

    const before = draft.slice(0, realSelectionStart);
    const after = draft.slice(realSelectionStart);

    const updatedDraft = `${before}\n${after}`;

    this.setState({ draft: updatedDraft });
    updateDraftForConversation({
      conversationKey: selectedConversationKey,
      draft: updatedDraft,
    });
  }

  private async onSendMessage() {
    if (!this.props.selectedConversationKey) {
      throw new Error('selectedConversationKey is needed');
    }
    this.linkPreviewAbortController?.abort();

    const messagePlaintext = cleanMentions(this.state.draft);

    const { selectedConversation } = this.props;

    if (!selectedConversation) {
      return;
    }

    if (selectedConversation.isBlocked) {
      ToastUtils.pushUnblockToSend();
      return;
    }
    // Verify message length
    const msgLen = messagePlaintext?.length || 0;
    if (msgLen === 0 && this.props.stagedAttachments?.length === 0) {
      return;
    }

    if (!selectedConversation.isPrivate && selectedConversation.isKickedFromGroup) {
      ToastUtils.pushYouLeftTheGroup();
      return;
    }

    const { quotedMessageProps } = this.props;

    const { stagedLinkPreview } = this.state;

    // Send message
    const extractedQuotedMessageProps = _.pick(
      quotedMessageProps,
      'id',
      'author',
      'text',
      'attachments'
    );

    // we consider that a link preview without a title at least is not a preview
    const linkPreview =
      stagedLinkPreview?.isLoaded && stagedLinkPreview.title?.length
        ? _.pick(stagedLinkPreview, 'url', 'image', 'title')
        : undefined;

    try {
      const { attachments, previews } = await this.getFiles(linkPreview);
      this.props.sendMessage({
        body: messagePlaintext.trim(),
        attachments: attachments || [],
        quote: extractedQuotedMessageProps,
        preview: previews,
        groupInvitation: undefined,
      });

      window.inboxStore?.dispatch(
        removeAllStagedAttachmentsInConversation({
          conversationId: this.props.selectedConversationKey,
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
        conversationKey: this.props.selectedConversationKey,
        draft: '',
      });
    } catch (e) {
      // Message sending failed
      window?.log?.error(e);
    }
  }

  // this function is called right before sending a message, to gather really the files behind attachments.
  private async getFiles(
    linkPreview?: Pick<StagedLinkPreviewData, 'url' | 'title' | 'image'>
  ): Promise<{
    attachments: Array<StagedAttachmentImportedType>;
    previews: Array<StagedPreviewImportedType>;
  }> {
    const { stagedAttachments } = this.props;

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
      // store the first image preview locally and get the path and details back to include them in the message
      const firstLinkPreviewImage = linkPreview.image;
      if (firstLinkPreviewImage && !isEmpty(firstLinkPreviewImage)) {
        const storedLinkPreviewAttachment = await AttachmentUtil.getFileAndStoreLocallyImageBuffer(
          firstLinkPreviewImage.data
        );
        if (storedLinkPreviewAttachment) {
          previews = [{ ...sharedDetails, image: storedLinkPreviewAttachment }];
        } else {
          // we couldn't save the image or whatever error happened, just return the url + title
          previews = [sharedDetails];
        }
      } else {
        // we did not fetch an image from the server
        previews = [sharedDetails];
      }
    }

    return { attachments, previews };
  }

  private async sendVoiceMessage(audioBlob: Blob) {
    if (!this.state.showRecordingView) {
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
      body: '',
      attachments: [audioAttachment],
      preview: undefined,
      quote: undefined,
      groupInvitation: undefined,
    });

    this.onExitVoiceNoteView();
  }

  private async onLoadVoiceNoteView() {
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
    if (!this.props.selectedConversationKey) {
      throw new Error('selectedConversationKey is needed');
    }
    const messageBox = this.textarea.current;
    if (!messageBox) {
      return;
    }

    const { draft } = this.state;

    const currentSelectionStart = Number(messageBox.selectionStart);

    const realSelectionStart = getSelectionBasedOnMentions(draft, currentSelectionStart);

    const before = draft.slice(0, realSelectionStart);
    const end = draft.slice(realSelectionStart);

    const newMessage = `${before}${emoji.native}${end}`;
    this.setState({ draft: newMessage });
    updateDraftForConversation({
      conversationKey: this.props.selectedConversationKey,
      draft: newMessage,
    });

    // update our selection because updating text programmatically
    // will put the selection at the end of the textarea
    // const selectionStart = currentSelectionStart + Number(1);
    // messageBox.selectionStart = selectionStart;
    // messageBox.selectionEnd = selectionStart;

    // // Sometimes, we have to repeat the set of the selection position with a timeout to be effective
    // setTimeout(() => {
    //   messageBox.selectionStart = selectionStart;
    //   messageBox.selectionEnd = selectionStart;
    // }, 20);
  }

  private focusCompositionBox() {
    // Focus the textarea when user clicks anywhere in the composition box
    this.textarea.current?.focus();
  }
}

const mapStateToProps = (state: StateType) => {
  return {
    quotedMessageProps: getQuotedMessage(state),
    selectedConversation: getSelectedConversation(state),
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
