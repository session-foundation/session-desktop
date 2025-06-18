import { isEmpty } from 'lodash';
import styled from 'styled-components';

import { useDisableDrag } from '../../../../../hooks/useDisableDrag';
import { useEncryptedFileFetch } from '../../../../../hooks/useEncryptedFileFetch';

import { QuoteIcon } from './QuoteIconContainer';
import { AriaLabels } from '../../../../../util/hardcodedAriaLabels';
import { LucideIcon } from '../../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../../../icon/lucide';

const StyledQuoteImage = styled.div`
  flex: initial;
  min-width: 54px;
  width: 54px;
  max-height: 54px;
  position: relative;
  border-radius: 4px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const StyledPlayButton = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;

  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;

  div {
    display: flex;
    align-items: center;
    justify-content: center;

    height: 32px;
    width: 32px;
    border-radius: 50%;
    background-color: var(--chat-buttons-background-color);
  }
`;

export const QuoteImage = (props: {
  url: string;
  contentType: string;
  showPlayButton?: boolean;
  imageBroken: boolean;
  handleImageErrorBound: () => void;
}) => {
  const { url, contentType, showPlayButton, imageBroken, handleImageErrorBound } = props;

  const disableDrag = useDisableDrag();

  const { loading, urlToLoad } = useEncryptedFileFetch(url, contentType, false);
  const srcData = !loading ? urlToLoad : '';

  return !isEmpty(srcData) && !imageBroken ? (
    <StyledQuoteImage>
      <img
        src={srcData}
        onDragStart={disableDrag}
        onError={handleImageErrorBound}
        alt={AriaLabels.quoteImageThumbnail}
      />
      {showPlayButton && (
        <StyledPlayButton>
          <div>
            <LucideIcon
              unicode={LUCIDE_ICONS_UNICODE.PLAY}
              iconSize="small"
              iconColor="var(--chat-buttons-icon-color)"
              style={{
                backgroundColor: 'var(--chat-buttons-background-color)',
              }}
            />
          </div>
        </StyledPlayButton>
      )}
    </StyledQuoteImage>
  ) : (
    <QuoteIcon
      unicode={showPlayButton ? LUCIDE_ICONS_UNICODE.CLAPERBOARD : LUCIDE_ICONS_UNICODE.IMAGE}
    />
  );
};
