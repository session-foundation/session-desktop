import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { getAppDispatch } from '../../state/dispatch';

import { quoteMessage } from '../../state/ducks/conversations';
import { getQuotedMessage } from '../../state/selectors/conversations';
import { getAlt, isAudio } from '../../types/Attachment';
import { AUDIO_MP3 } from '../../types/MIME';
import { Flex } from '../basic/Flex';
import { Image } from './Image';

import { findAndFormatContact } from '../../models/message';
import { getAbsoluteAttachmentPath } from '../../types/MessageAttachment';
import { GoogleChrome } from '../../util';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { LucideIcon } from '../icon/LucideIcon';
import { tr } from '../../localization/localeTools';
import { ContactName } from './ContactName/ContactName';
import { QuoteText } from './message/message-content/quote/QuoteText';
import { useSelectedConversationKey } from '../../state/selectors/selectedConversation';
import { useEscBlurThenHandler } from '../../hooks/useKeyboardShortcut';

const QuotedMessageComposition = styled(Flex)`
  border-top: var(--default-borders);
`;

const QuotedMessageCompositionReply = styled(Flex)<{ $hasAttachments: boolean }>`
  ${props => !props.$hasAttachments && 'border-left: 3px solid var(--primary-color);'}
  min-width: 0;
`;

const Subtle = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  display: -webkit-box;
  color: var(--text-primary-color);
  font-size: var(--font-display-size-md);
`;

const StyledImage = styled.div`
  div {
    border-radius: 4px;
    overflow: hidden;
  }
`;

const StyledText = styled(Flex)`
  margin: 0 var(--margins-sm) 0 var(--margins-sm);
  min-width: 0;
  p {
    font-weight: bold;
    margin: 0;
  }
`;

function checkHasAttachments(attachments: Array<any> | undefined) {
  const hasAttachments = attachments && attachments.length > 0 && attachments[0];

  // NOTE could be a video as well which will load a thumbnail
  const firstImageLikeAttachment =
    hasAttachments && attachments[0].contentType !== AUDIO_MP3 && attachments[0].thumbnail
      ? attachments[0]
      : undefined;

  return { hasAttachments, firstImageLikeAttachment };
}

export const SessionQuotedMessageComposition = () => {
  const dispatch = getAppDispatch();
  const quotedMessageProps = useSelector(getQuotedMessage);
  const conversationId = useSelectedConversationKey();

  const { author, attachments, text: quoteText } = quotedMessageProps || {};

  const removeQuotedMessage = () => {
    const cancelPropagation = !!quotedMessageProps?.id;
    dispatch(quoteMessage(undefined));
    return cancelPropagation;
  };

  useEscBlurThenHandler(removeQuotedMessage);

  if (!author || !quotedMessageProps?.id) {
    return null;
  }

  const contact = findAndFormatContact(author);

  const { hasAttachments, firstImageLikeAttachment } = checkHasAttachments(attachments);
  const isImage = Boolean(
    firstImageLikeAttachment &&
      GoogleChrome.isImageTypeSupported(firstImageLikeAttachment.contentType)
  );
  const isVideo = Boolean(
    firstImageLikeAttachment &&
      GoogleChrome.isVideoTypeSupported(firstImageLikeAttachment.contentType)
  );
  const hasAudioAttachment = Boolean(hasAttachments && isAudio(attachments));
  const isGenericFile = !hasAudioAttachment && !isVideo && !isImage;

  const subtitleText = quoteText ? (
    /** isIncoming must be true here otherwise the text content is the same color as the background */
    <QuoteText isIncoming={true} text={quoteText} referencedMessageNotFound={true} />
  ) : (
    tr(
      hasAudioAttachment
        ? 'audio'
        : isGenericFile
          ? 'document'
          : isVideo
            ? 'video'
            : isImage
              ? 'image'
              : 'messageErrorOriginal'
    )
  );

  return (
    <QuotedMessageComposition
      $container={true}
      $justifyContent="space-between"
      $alignItems="center"
      width={'100%'}
      $flexGrow={1}
      $padding={'var(--margins-md)'}
    >
      <QuotedMessageCompositionReply
        $container={true}
        $justifyContent="flex-start"
        $alignItems={'center'}
        $hasAttachments={hasAttachments}
      >
        {hasAttachments && (
          <StyledImage>
            {firstImageLikeAttachment ? (
              <Image
                alt={getAlt(firstImageLikeAttachment)}
                attachment={firstImageLikeAttachment}
                height={100}
                width={100}
                url={getAbsoluteAttachmentPath((firstImageLikeAttachment as any).thumbnail.path)}
                softCorners={true}
              />
            ) : hasAudioAttachment ? (
              <div style={{ margin: '0 var(--margins-xs) 0 0' }}>
                <LucideIcon unicode={LUCIDE_ICONS_UNICODE.MIC} iconSize="huge" />
              </div>
            ) : null}
          </StyledImage>
        )}
        <StyledText
          $container={true}
          $flexDirection="column"
          $justifyContent={'center'}
          $alignItems={'flex-start'}
        >
          <ContactName
            pubkey={contact.pubkey}
            conversationId={conversationId}
            contactNameContext="quoted-message-composition"
            style={{ maxWidth: '100%', whiteSpace: 'nowrap' }}
          />
          {subtitleText && <Subtle>{subtitleText}</Subtle>}
        </StyledText>
      </QuotedMessageCompositionReply>

      <SessionLucideIconButton
        unicode={LUCIDE_ICONS_UNICODE.X}
        iconColor="var(--chat-buttons-icon-color)"
        iconSize="medium"
        onClick={removeQuotedMessage}
        margin={'0 var(--margins-md) 0 0'} // We want this aligned with the send button
        aria-label={tr('close')}
        dataTestId="link-preview-close"
      />
    </QuotedMessageComposition>
  );
};
