import { useCallback, useEffect, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
// tslint:disable-next-line: no-submodule-imports
import useKey from 'react-use/lib/useKey';
import { clipboard } from 'electron';
import { PropsForAttachment, closeRightPanel } from '../../../../../state/ducks/conversations';
import { getMessageInfoId } from '../../../../../state/selectors/conversations';
import { Flex } from '../../../../basic/Flex';
import { Header, HeaderTitle, StyledScrollContainer } from '../components';

import { IsDetailMessageViewContext } from '../../../../../contexts/isDetailViewContext';
import { Data } from '../../../../../data/data';
import { useRightOverlayMode } from '../../../../../hooks/useUI';
import {
  replyToMessage,
  resendMessage,
} from '../../../../../interactions/conversationInteractions';
import { deleteMessagesById } from '../../../../../interactions/conversations/unsendingInteractions';
import {
  useMessageAttachments,
  useMessageAuthor,
  useMessageBody,
  useMessageDirection,
  useMessageIsDeletable,
  useMessageQuote,
  useMessageSender,
  useMessageServerTimestamp,
  useMessageText,
  useMessageTimestamp,
} from '../../../../../state/selectors';
import {
  useSelectedConversationKey,
  useSelectedIsLegacyGroup,
} from '../../../../../state/selectors/selectedConversation';
import { canDisplayImagePreview } from '../../../../../types/Attachment';
import { isAudio } from '../../../../../types/MIME';
import {
  getAudioDuration,
  getVideoDuration,
} from '../../../../../types/attachments/VisualAttachment';
import { GoogleChrome } from '../../../../../util';
import { saveAttachmentToDisk } from '../../../../../util/attachmentsUtil';
import { SpacerLG, SpacerMD, SpacerXL } from '../../../../basic/Text';
import { PanelButtonGroup, PanelIconButton } from '../../../../buttons';
import { Message } from '../../../message/message-item/Message';
import { AttachmentInfo, MessageInfo } from './components';
import { AttachmentCarousel } from './components/AttachmentCarousel';
import { ToastUtils } from '../../../../../session/utils';
import { LUCIDE_ICONS_UNICODE } from '../../../../icon/lucide';
import { PanelIconLucideIcon } from '../../../../buttons/PanelIconButton';
import { useShowCopyAccountIdCb } from '../../../../menuAndSettingsHooks/useCopyAccountId';
import { localize } from '../../../../../localization/localeTools';
import { sectionActions } from '../../../../../state/ducks/section';
import { useIsIncomingRequest } from '../../../../../hooks/useParamSelector';

// NOTE we override the default max-widths when in the detail isDetailView
const StyledMessageBody = styled.div`
  padding-bottom: var(--margins-lg);
  .module-message {
    pointer-events: none;

    max-width: 100%;
    @media (min-width: 1200px) {
      max-width: 100%;
    }
  }
`;

const MessageBody = ({
  messageId,
  supportsAttachmentCarousel,
}: {
  messageId: string;
  supportsAttachmentCarousel: boolean;
}) => {
  const quote = useMessageQuote(messageId);
  const text = useMessageText(messageId);

  // NOTE we don't want to render the message body if it's empty and the attachments carousel can render it instead
  if (supportsAttachmentCarousel && !text && !quote) {
    return null;
  }

  return (
    <IsDetailMessageViewContext.Provider value={true}>
      <StyledMessageBody>
        <Message messageId={messageId} />
      </StyledMessageBody>
    </IsDetailMessageViewContext.Provider>
  );
};

const StyledMessageInfoContainer = styled.div`
  height: calc(100% - 48px);
  width: 100%;
  max-width: 650px;
  overflow: hidden auto;
  z-index: 2;

  margin-inline-start: auto;
  margin-inline-end: auto;
  padding: var(--margins-sm) var(--margins-2xl) var(--margins-lg);
`;

type MessageInfoProps = {
  errors?: string;
  attachments: Array<PropsForAttachment>;
};

async function getPropsForMessageInfo(
  messageId: string | undefined,
  attachments: Array<PropsForAttachment>
): Promise<MessageInfoProps | null> {
  if (!messageId) {
    return null;
  }
  const found = await Data.getMessageById(messageId);
  const attachmentsWithMediaDetails: Array<PropsForAttachment> = [];
  if (found) {
    // process attachments so we have the fileSize, url and screenshots
    for (let i = 0; i < attachments.length; i++) {
      const props = found.getPropsForAttachment(attachments[i]);
      if (
        props?.contentType &&
        GoogleChrome.isVideoTypeSupported(props?.contentType) &&
        !props.duration &&
        props.url
      ) {
        // eslint-disable-next-line no-await-in-loop
        const duration = await getVideoDuration({
          objectUrl: props.url,
          contentType: props.contentType,
        });
        attachmentsWithMediaDetails.push({
          ...props,
          duration,
        });
      } else if (props?.contentType && isAudio(props.contentType) && !props.duration && props.url) {
        // eslint-disable-next-line no-await-in-loop
        const duration = await getAudioDuration({
          objectUrl: props.url,
          contentType: props.contentType,
        });

        attachmentsWithMediaDetails.push({
          ...props,
          duration,
        });
      } else if (props) {
        attachmentsWithMediaDetails.push(props);
      }
    }

    const errors = found.get('errors');

    const toRet: MessageInfoProps = {
      errors,
      attachments: attachmentsWithMediaDetails,
    };

    return toRet;
  }
  return null;
}

function useMessageInfo(messageId: string | undefined) {
  const [details, setDetails] = useState<MessageInfoProps | null>(null);

  const fromState = useMessageAttachments(messageId);

  // this is not ideal, but also doesn't seem to create any performance issue at the moment.
  // TODO: ideally, we'd want to save the attachment duration anytime we save one to the disk (incoming/outgoing), and just retrieve it from the redux state here.
  useEffect(() => {
    let mounted = true;
    // eslint-disable-next-line more/no-then
    void getPropsForMessageInfo(messageId, fromState || [])
      .then(result => {
        if (mounted) {
          setDetails(result);
        }
      })
      .catch(window.log.error);

    return () => {
      mounted = false;
    };
  }, [fromState, messageId]);

  return details;
}

type WithMessageIdOpt = { messageId: string };

/**
 * Always shown, even if the message has no body so we always have at least one item in the PanelButtonGroup
 */
function CopyMessageBodyButton({ messageId }: WithMessageIdOpt) {
  const messageBody = useMessageBody(messageId);
  if (!messageBody) {
    return null;
  }
  return (
    <PanelIconButton
      text={localize('copy').toString()}
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.COPY} />}
      onClick={() => {
        clipboard.writeText(messageBody || '');
        ToastUtils.pushCopiedToClipBoard();
      }}
      dataTestId="copy-msg-from-details"
    />
  );
}

function ReplyToMessageButton({ messageId }: WithMessageIdOpt) {
  const dispatch = useDispatch();
  if (!messageId) {
    return null;
  }
  return (
    <PanelIconButton
      text={localize('reply').toString()}
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.REPLY} />}
      onClick={() => {
        // eslint-disable-next-line more/no-then
        void replyToMessage(messageId).then(foundIt => {
          if (foundIt) {
            dispatch(closeRightPanel());
            dispatch(sectionActions.resetRightOverlayMode());
          }
        });
      }}
      dataTestId="reply-to-msg-from-details"
    />
  );
}

function CopySenderSessionId({ messageId }: WithMessageIdOpt) {
  const senderId = useMessageAuthor(messageId);
  const copySenderIdCb = useShowCopyAccountIdCb(senderId);

  if (!copySenderIdCb || !senderId) {
    return null;
  }

  return (
    <PanelIconButton
      text={localize('accountIDCopy').toString()}
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.COPY} />}
      onClick={copySenderIdCb}
      dataTestId="copy-sender-from-details"
    />
  );
}

export const OverlayMessageInfo = () => {
  const dispatch = useDispatch();

  const rightOverlayMode = useRightOverlayMode();
  const messageId = useSelector(getMessageInfoId);
  const messageInfo = useMessageInfo(messageId);
  const isDeletable = useMessageIsDeletable(messageId);
  const direction = useMessageDirection(messageId);
  const timestamp = useMessageTimestamp(messageId);
  const serverTimestamp = useMessageServerTimestamp(messageId);
  const sender = useMessageSender(messageId);

  const isLegacyGroup = useSelectedIsLegacyGroup();

  // we close the right panel when switching conversation so the convoId of that message is always the selectedConversationKey
  // is always the currently selected conversation
  const convoId = useSelectedConversationKey();

  const isIncomingMessageRequest = useIsIncomingRequest(convoId);

  const closePanel = useCallback(() => {
    dispatch(closeRightPanel());
    dispatch(sectionActions.resetRightOverlayMode());
  }, [dispatch]);

  useKey('Escape', closePanel);

  // close the panel if the messageInfo is associated with a deleted message
  useEffect(() => {
    if (!sender) {
      closePanel();
    }
  }, [sender, closePanel]);

  if (!rightOverlayMode || !messageInfo || !convoId || !messageId || !sender) {
    return null;
  }

  const { params } = rightOverlayMode;
  const visibleAttachmentIndex = params?.visibleAttachmentIndex || 0;

  const { errors, attachments } = messageInfo;

  const hasAttachments = attachments && attachments.length > 0;
  const supportsAttachmentCarousel = canDisplayImagePreview(attachments);
  const hasErrors = errors && errors.length > 0;

  const handleChangeAttachment = (changeDirection: 1 | -1) => {
    if (!hasAttachments) {
      return;
    }

    const newVisibleIndex = visibleAttachmentIndex + changeDirection;
    if (newVisibleIndex > attachments.length - 1) {
      return;
    }

    if (newVisibleIndex < 0) {
      return;
    }

    if (attachments[newVisibleIndex]) {
      dispatch(
        sectionActions.setRightOverlayMode({
          type: 'message_info',
          params: { messageId, visibleAttachmentIndex: newVisibleIndex },
        })
      );
    }
  };

  return (
    <StyledScrollContainer>
      <Flex $container={true} $flexDirection={'column'} $alignItems={'center'}>
        <Header
          hideCloseButton={false}
          closeButtonOnClick={closePanel}
          paddingTop="var(--margins-2xl)"
        >
          <HeaderTitle>{localize('messageInfo')}</HeaderTitle>
        </Header>
        <StyledMessageInfoContainer>
          <MessageBody
            messageId={messageId}
            supportsAttachmentCarousel={supportsAttachmentCarousel}
          />
          {hasAttachments && (
            <>
              {supportsAttachmentCarousel && (
                <>
                  <AttachmentCarousel
                    messageId={messageId}
                    attachments={attachments}
                    visibleIndex={visibleAttachmentIndex}
                    nextAction={() => {
                      handleChangeAttachment(1);
                    }}
                    previousAction={() => {
                      handleChangeAttachment(-1);
                    }}
                  />
                  <SpacerXL />
                </>
              )}
              <AttachmentInfo attachment={attachments[visibleAttachmentIndex]} />
              <SpacerMD />
            </>
          )}
          <MessageInfo messageId={messageId} errors={messageInfo.errors} />
          <SpacerLG />
          <PanelButtonGroup style={{ margin: '0' }}>
            {/* CopyMessageBodyButton is always shown so the PanelButtonGroup always has at least one item */}
            <CopyMessageBodyButton messageId={messageId} />
            {!isLegacyGroup && <ReplyToMessageButton messageId={messageId} />}
            <CopySenderSessionId messageId={messageId} />
            {hasErrors && !isLegacyGroup && direction === 'outgoing' && (
              <PanelIconButton
                text={localize('resend').toString()}
                iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.REFRESH_CW} />}
                onClick={() => {
                  void resendMessage(messageId);
                  dispatch(closeRightPanel());
                  dispatch(sectionActions.resetRightOverlayMode());
                }}
                dataTestId="resend-msg-from-details"
              />
            )}
            {/* Saving attachments sends a data extraction message so it must be disabled for message requests. */}
            {hasAttachments && !isIncomingMessageRequest && (
              <PanelIconButton
                text={localize('save').toString()}
                iconElement={
                  <PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.CIRCLE_ARROW_DOWN} />
                }
                dataTestId="save-attachment-from-details"
                onClick={() => {
                  if (hasAttachments) {
                    void saveAttachmentToDisk({
                      conversationId: convoId,
                      messageSender: sender,
                      messageTimestamp: serverTimestamp || timestamp || Date.now(),
                      attachment: attachments[visibleAttachmentIndex],
                      index: visibleAttachmentIndex,
                    });
                  }
                }}
              />
            )}
            {/* Deleting messages sends a "delete message" message so it must be disabled for message requests. */}
            {isDeletable && !isLegacyGroup && !isIncomingMessageRequest && (
              <PanelIconButton
                text={localize('delete').toString()}
                iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.TRASH2} />}
                color={'var(--danger-color)'}
                dataTestId="delete-from-details"
                onClick={() => {
                  void deleteMessagesById([messageId], convoId);
                }}
              />
            )}
          </PanelButtonGroup>
          <SpacerXL />
        </StyledMessageInfoContainer>
      </Flex>
    </StyledScrollContainer>
  );
};
