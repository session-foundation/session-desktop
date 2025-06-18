import { isEmpty, noop } from 'lodash';
import styled from 'styled-components';

import { MIME } from '../../../../../types';
import { GoogleChrome } from '../../../../../util';
import { QuotedAttachmentThumbnailType, QuoteProps } from './Quote';

import { QuoteImage } from './QuoteImage';
import { LUCIDE_ICONS_UNICODE, type WithLucideUnicode } from '../../../../icon/lucide';
import { LucideIcon } from '../../../../icon/LucideIcon';

function getObjectUrl(thumbnail: QuotedAttachmentThumbnailType | undefined): string | undefined {
  if (thumbnail && thumbnail.objectUrl) {
    return thumbnail.objectUrl;
  }

  return undefined;
}

const StyledQuoteIconContainer = styled.div`
  flex: initial;
  min-width: 54px;
  width: 54px;
  max-height: 54px;
  position: relative;
`;

const StyledQuoteIcon = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;

  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledQuoteIconBackground = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  height: 54px;
  width: 54px;
  border-radius: var(--margins-sm);
  background-color: var(--message-link-preview-background-color);

  &:hover {
    background-color: var(--message-link-preview-background-color);
  }
`;

export const QuoteIcon = (props: WithLucideUnicode) => {
  const { unicode } = props;

  return (
    <StyledQuoteIconContainer>
      <StyledQuoteIcon>
        <StyledQuoteIconBackground>
          <LucideIcon unicode={unicode} iconSize="medium" iconColor="currentColor" />
        </StyledQuoteIconBackground>
      </StyledQuoteIcon>
    </StyledQuoteIconContainer>
  );
};

export const QuoteIconContainer = (
  props: Pick<QuoteProps, 'attachment' | 'referencedMessageNotFound'> & {
    handleImageErrorBound: () => void;
    imageBroken: boolean;
  }
) => {
  const { attachment, imageBroken, handleImageErrorBound, referencedMessageNotFound } = props;

  if (referencedMessageNotFound || !attachment || isEmpty(attachment)) {
    return null;
  }

  const { contentType, thumbnail } = attachment;
  const objectUrl = getObjectUrl(thumbnail);

  if (GoogleChrome.isVideoTypeSupported(contentType)) {
    return objectUrl && !imageBroken ? (
      <QuoteImage
        url={objectUrl}
        contentType={MIME.IMAGE_JPEG}
        showPlayButton={true}
        imageBroken={imageBroken}
        handleImageErrorBound={noop}
      />
    ) : (
      <QuoteIcon unicode={LUCIDE_ICONS_UNICODE.CLAPERBOARD} />
    );
  }

  if (GoogleChrome.isImageTypeSupported(contentType)) {
    return objectUrl && !imageBroken ? (
      <QuoteImage
        url={objectUrl}
        contentType={contentType}
        imageBroken={imageBroken}
        handleImageErrorBound={handleImageErrorBound}
      />
    ) : (
      <QuoteIcon unicode={LUCIDE_ICONS_UNICODE.IMAGE} />
    );
  }

  if (MIME.isAudio(contentType)) {
    return <QuoteIcon unicode={LUCIDE_ICONS_UNICODE.MIC} />;
  }

  return <QuoteIcon unicode={LUCIDE_ICONS_UNICODE.FILE} />;
};
