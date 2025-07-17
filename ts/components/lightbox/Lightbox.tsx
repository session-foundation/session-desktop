import { CSSProperties, MouseEvent, MutableRefObject, useRef } from 'react';

import { isUndefined } from 'lodash';
import { useDispatch } from 'react-redux';
import useUnmount from 'react-use/lib/useUnmount';
import styled from 'styled-components';
import { useDisableDrag } from '../../hooks/useDisableDrag';
import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';
import { updateLightBoxOptions } from '../../state/ducks/modalDialog';
import * as MIME from '../../types/MIME';
import { GoogleChrome } from '../../util';
import { Flex } from '../basic/Flex';
import { SessionIconSize } from '../icon';
import { AriaLabels } from '../../util/hardcodedAriaLabels';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { SessionLucideIconButton } from '../icon/SessionIconButton';

type Props = {
  contentType: MIME.MIMEType | undefined;
  objectURL: string;
  caption?: string;
  onNext?: () => void;
  onPrevious?: () => void;
  onSave?: () => void;
  onClose?: () => void;
};

const CONTROLS_WIDTH = 50;
const CONTROLS_SPACING = 10;

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    width: '100vw',
    height: '100vh',
    left: 0,
    zIndex: 150, // modals are 100
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'var(--lightbox-background-color)',
  } as CSSProperties,
  mainContainer: {
    display: 'flex',
    flexDirection: 'row',
    flexGrow: 1,
    paddingTop: 40,
    paddingLeft: 40,
    paddingRight: 40,
    paddingBottom: 0,
    minHeight: 0,
    overflow: 'hidden',
    minWidth: 0,
  } as CSSProperties,
  objectContainer: {
    position: 'relative',
    flexGrow: 1,
    display: 'inline-flex',
    justifyContent: 'center',
  } as CSSProperties,
  objectParentContainer: {
    flexGrow: 1,
    textAlign: 'center' as const,
    margin: 'auto',
  },
  object: {
    flexGrow: 1,
    flexShrink: 0,
    maxWidth: '80vw',
    maxHeight: '80vh',
    objectFit: 'contain',
  } as CSSProperties,
  caption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'black',
    padding: '1em',
    paddingLeft: '3em',
    paddingRight: '3em',
    backgroundColor: 'var(--lightbox-caption-background-color)',
  } as CSSProperties,
  controlsOffsetPlaceholder: {
    width: CONTROLS_WIDTH,
    marginRight: CONTROLS_SPACING,
    flexShrink: 0,
  },
  controls: {
    width: CONTROLS_WIDTH,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    marginLeft: CONTROLS_SPACING,
    justifyContent: 'space-between',
  } as CSSProperties,
  navigationContainer: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 10,
    height: '70px', // force it so the buttons stick to the bottom
  } as CSSProperties,
  saveButton: {
    marginTop: 10,
  },
  iconButtonPlaceholder: {
    // Dimensions match `.iconButton`:
    display: 'inline-block',
    width: 30,
    height: 30,
  },
};

const StyledIconButton = styled.div`
  .session-icon-button {
    opacity: 0.4;
    transition: opacity var(--default-duration);

    &:hover {
      opacity: 1;
    }
  }
`;

interface IconButtonProps {
  onClick?: () => void;
  style?: CSSProperties;
  unicode:
    | LUCIDE_ICONS_UNICODE.CHEVRON_RIGHT
    | LUCIDE_ICONS_UNICODE.CHEVRON_LEFT
    | LUCIDE_ICONS_UNICODE.X
    | LUCIDE_ICONS_UNICODE.DOWNLOAD;
}

const IconButton = ({ onClick, unicode }: IconButtonProps) => {
  const clickHandler = (): void => {
    if (!onClick) {
      return;
    }
    onClick();
  };

  // default to huge, only download is bigger
  let iconSize: SessionIconSize = 'huge';
  switch (unicode) {
    case LUCIDE_ICONS_UNICODE.DOWNLOAD:
      iconSize = 'huge2';
      break;
    default:
      break;
  }

  return (
    <StyledIconButton>
      <SessionLucideIconButton
        unicode={unicode}
        iconSize={iconSize}
        // the lightbox has a dark background
        iconColor="var(--lightbox-icon-stroke-color)"
        onClick={clickHandler}
      />
    </StyledIconButton>
  );
};

const IconButtonPlaceholder = () => <div style={styles.iconButtonPlaceholder} />;

export const LightboxObject = ({
  objectURL,
  contentType,
  renderedRef,
  onObjectClick,
}: {
  objectURL: string;
  contentType: MIME.MIMEType;
  renderedRef: MutableRefObject<any>;
  onObjectClick: (event: any) => any;
}) => {
  const { urlToLoad } = useEncryptedFileFetch(objectURL, contentType, false);

  const isImageTypeSupported = GoogleChrome.isImageTypeSupported(contentType);

  // auto play video on showing a video attachment
  useUnmount(() => {
    if (!renderedRef?.current) {
      return;
    }
    renderedRef.current.pause.pause();
  });
  const disableDrag = useDisableDrag();

  if (isImageTypeSupported) {
    return (
      <img
        style={styles.object as any}
        onDragStart={disableDrag}
        src={urlToLoad}
        alt={AriaLabels.imageSentInConversation}
        ref={renderedRef}
      />
    );
  }

  const isVideoTypeSupported = GoogleChrome.isVideoTypeSupported(contentType);
  if (isVideoTypeSupported) {
    if (urlToLoad) {
      if (renderedRef?.current?.paused) {
        void renderedRef?.current?.play();
      }
    }

    return (
      <video
        role="button"
        ref={renderedRef}
        controls={true}
        style={styles.object as any}
        key={urlToLoad}
      >
        <source src={urlToLoad} />
      </video>
    );
  }

  const isUnsupportedImageType = !isImageTypeSupported && MIME.isImage(contentType);
  const isUnsupportedVideoType = !isVideoTypeSupported && MIME.isVideo(contentType);
  if (isUnsupportedImageType || isUnsupportedVideoType) {
    return (
      <SessionLucideIconButton
        unicode={
          isUnsupportedVideoType ? LUCIDE_ICONS_UNICODE.CLAPERBOARD : LUCIDE_ICONS_UNICODE.IMAGE
        }
        iconSize="huge2"
        onClick={onObjectClick}
        iconColor="var(--lightbox-icon-stroke-color)"
      />
    );
  }

  window.log.info('Lightbox: Unexpected content type', { contentType });

  return (
    <SessionLucideIconButton
      unicode={LUCIDE_ICONS_UNICODE.FILE}
      iconSize="huge2"
      onClick={onObjectClick}
      iconColor="var(--lightbox-icon-stroke-color)"
    />
  );
};

export const Lightbox = (props: Props) => {
  const renderedRef = useRef<any>(null);
  const dispatch = useDispatch();
  const { caption, contentType, objectURL, onNext, onPrevious, onSave, onClose } = props;

  const onObjectClick = (event: any) => {
    event.stopPropagation();
    dispatch(updateLightBoxOptions(null));
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    dispatch(updateLightBoxOptions(null));
  };

  const onContainerClick = (event: MouseEvent<HTMLDivElement>) => {
    if (renderedRef && event.target === renderedRef.current) {
      return;
    }
    handleClose();
  };

  return (
    <div style={styles.container as any} role="dialog" onClick={onContainerClick}>
      <div style={styles.mainContainer as any}>
        <div style={styles.controlsOffsetPlaceholder} />
        <div style={styles.objectParentContainer} role="button">
          <div style={styles.objectContainer as any}>
            {!isUndefined(contentType) ? (
              <LightboxObject
                objectURL={objectURL}
                contentType={contentType}
                renderedRef={renderedRef}
                onObjectClick={onObjectClick}
              />
            ) : null}
            {caption ? <div style={styles.caption as any}>{caption}</div> : null}
          </div>
        </div>
        <div style={styles.controls as any}>
          <Flex $container={true}>
            <IconButton unicode={LUCIDE_ICONS_UNICODE.X} onClick={handleClose} />
          </Flex>

          {onSave ? (
            <IconButton
              unicode={LUCIDE_ICONS_UNICODE.DOWNLOAD}
              onClick={onSave}
              style={styles.saveButton}
            />
          ) : null}
        </div>
      </div>
      <div style={styles.navigationContainer as any}>
        {onPrevious ? (
          <IconButton unicode={LUCIDE_ICONS_UNICODE.CHEVRON_LEFT} onClick={onPrevious} />
        ) : (
          <IconButtonPlaceholder />
        )}
        {onNext ? (
          <IconButton unicode={LUCIDE_ICONS_UNICODE.CHEVRON_RIGHT} onClick={onNext} />
        ) : (
          <IconButtonPlaceholder />
        )}
      </div>
    </div>
  );
};
