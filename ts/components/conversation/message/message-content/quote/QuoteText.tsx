import { isEmpty } from 'lodash';

import styled from 'styled-components';
import {
  useSelectedIsGroupOrCommunity,
  useSelectedIsPublic,
} from '../../../../../state/selectors/selectedConversation';
import { MIME } from '../../../../../types';
import { GoogleChrome } from '../../../../../util';
import { MessageBody } from '../MessageBody';
import { QuoteProps } from './Quote';
import { tr } from '../../../../../localization/localeTools';

const StyledQuoteText = styled.div<{ $isIncoming: boolean }>`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;

  font-size: 15px;
  line-height: 18px;
  text-align: start;

  overflow: hidden;
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
  white-space: pre-wrap;

  color: ${props =>
    props.$isIncoming
      ? 'var(--message-bubbles-received-text-color)'
      : 'var(--message-bubbles-sent-text-color)'};
  a {
    color: ${props =>
      props.$isIncoming
        ? 'var(--color-received-message-text)'
        : 'var(--message-bubbles-sent-text-color)'};
  }
`;

function getTypeLabel({
  contentType,
  isVoiceMessage,
}: {
  contentType: MIME.MIMEType;
  isVoiceMessage: boolean;
}): string | undefined {
  if (GoogleChrome.isVideoTypeSupported(contentType)) {
    return tr('video');
  }
  if (GoogleChrome.isImageTypeSupported(contentType)) {
    return tr('image');
  }
  if (MIME.isAudio(contentType) && isVoiceMessage) {
    return tr('messageVoice');
  }
  if (MIME.isAudio(contentType)) {
    return tr('audio');
  }
  return tr('document');
}

export const QuoteText = (
  props: Pick<QuoteProps, 'text' | 'attachment' | 'isIncoming' | 'referencedMessageNotFound'>
) => {
  const { text, attachment, isIncoming, referencedMessageNotFound } = props;

  const isGroup = useSelectedIsGroupOrCommunity();
  const isPublic = useSelectedIsPublic();

  if (!referencedMessageNotFound && attachment && !isEmpty(attachment)) {
    const { contentType, isVoiceMessage } = attachment;

    const typeLabel = getTypeLabel({ contentType, isVoiceMessage });
    if (typeLabel && !text) {
      return <div>{typeLabel}</div>;
    }
  }

  return (
    <StyledQuoteText $isIncoming={isIncoming} dir="auto">
      <MessageBody
        text={text || tr('messageErrorOriginal')}
        disableRichContent={true}
        disableJumbomoji={true}
        isGroup={isGroup}
        isPublic={isPublic}
      />
    </StyledQuoteText>
  );
};
