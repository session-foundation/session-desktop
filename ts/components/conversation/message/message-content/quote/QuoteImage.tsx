import { isEmpty } from 'lodash';
import styled from 'styled-components';

import { useDisableDrag } from '../../../../../hooks/useDisableDrag';
import { useEncryptedFileFetch } from '../../../../../hooks/useEncryptedFileFetch';

import { QuoteIcon } from './QuoteIconContainer';
import { AriaLabels } from '../../../../../util/hardcodedAriaLabels';
import { LUCIDE_ICONS_UNICODE } from '../../../../icon/lucide';
import { PlayButtonCenteredAbsolute } from '../../../../buttons/PlayButton';

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
      {showPlayButton && <PlayButtonCenteredAbsolute iconSize="small" />}
    </StyledQuoteImage>
  ) : (
    <QuoteIcon
      unicode={showPlayButton ? LUCIDE_ICONS_UNICODE.CLAPERBOARD : LUCIDE_ICONS_UNICODE.IMAGE}
    />
  );
};
