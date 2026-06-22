import { CSSProperties, MouseEvent, useEffect, useRef, useState, type Ref } from 'react';

import { isUndefined } from 'lodash';
import useUnmount from 'react-use/lib/useUnmount';
import styled from 'styled-components';
import { getAppDispatch } from '../../state/dispatch';
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
import { SessionFocusTrap } from '../SessionFocusTrap';

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
const MIN_SCALE = 1;
const MAX_SCALE = 10;
const ZOOM_SENSITIVITY = 0.002;

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
    overflow: 'hidden',
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
    | LUCIDE_ICONS_UNICODE.ARROW_DOWN_TO_LINE;
  ref?: Ref<HTMLButtonElement>;
}

const IconButton = ({ onClick, unicode, ref }: IconButtonProps) => {
  const clickHandler = () => {
    onClick?.();
  };

  // default to huge, only download is bigger
  let iconSize: SessionIconSize = 'huge';
  switch (unicode) {
    case LUCIDE_ICONS_UNICODE.ARROW_DOWN_TO_LINE:
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
        ref={ref}
      />
    </StyledIconButton>
  );
};

const IconButtonPlaceholder = () => <div style={styles.iconButtonPlaceholder} />;

const LightboxObject = ({
  objectURL,
  contentType,
  renderedRef,
  onObjectClick,
}: {
  objectURL: string;
  contentType: MIME.MIMEType;
  renderedRef: React.RefObject<any>;
  onObjectClick: (e?: MouseEvent<HTMLButtonElement>) => void;
}) => {
  const { urlToLoad } = useEncryptedFileFetch(objectURL, contentType, false);

  // scale: 1 = fit-to-screen. translate is in px, relative to centered origin.
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom and pan whenever the displayed image changes (prev/next navigation)
  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [objectURL]);

  const isImageTypeSupported = GoogleChrome.isImageTypeSupported(contentType);

  // auto play video on showing a video attachment
  useUnmount(() => {
    if (!renderedRef?.current) {
      return;
    }
    renderedRef.current.pause();
  });
  const disableDrag = useDisableDrag();

  if (isImageTypeSupported) {
    const isZoomed = scale > 1;

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
      // ctrlKey is true for pinch-to-zoom on macOS trackpads as well as Ctrl+scroll on all platforms
      if (!e.ctrlKey && !e.metaKey) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      // Pointer position relative to container center (the transform origin)
      const pointerX = e.clientX - rect.left - rect.width / 2;
      const pointerY = e.clientY - rect.top - rect.height / 2;

      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * (1 + delta)));

      if (newScale === scale) {
        return;
      }

      // Adjust translate so the point under the pointer stays fixed
      const scaleFactor = newScale / scale;
      const newTranslateX = pointerX - scaleFactor * (pointerX - translate.x);
      const newTranslateY = pointerY - scaleFactor * (pointerY - translate.y);

      setScale(newScale);
      // Snap translate back to zero when returning to fit-to-screen
      if (newScale === MIN_SCALE) {
        setTranslate({ x: 0, y: 0 });
      } else {
        setTranslate({ x: newTranslateX, y: newTranslateY });
      }
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isZoomed) {
        return;
      }
      isDragging.current = true;
      didDrag.current = false;
      dragStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
      e.preventDefault();
      e.stopPropagation();
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging.current) {
        return;
      }
      didDrag.current = true;
      e.stopPropagation();
      setTranslate({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging.current) {
        e.stopPropagation();
      }
      isDragging.current = false;
    };

    const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    };

    const imgStyle: CSSProperties = {
      ...styles.object,
      transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
      transformOrigin: 'center center',
      transition: isDragging.current ? 'none' : 'transform 0.05s ease-out',
      cursor: isZoomed ? (isDragging.current ? 'grabbing' : 'grab') : 'default',
      // Let the image overflow the container; the container clips it
      flexShrink: 0,
      userSelect: 'none',
    };

    return (
      <div
        ref={containerRef}
        style={{ overflow: 'hidden' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <img
          style={imgStyle as any}
          onDragStart={disableDrag}
          src={urlToLoad}
          alt={AriaLabels.imageSentInConversation}
          ref={renderedRef}
          onClick={e => {
            if (didDrag.current) {
              e.stopPropagation();
            }
          }}
        />
      </div>
    );
  }

  const isVideoTypeSupported = GoogleChrome.isVideoTypeSupported(contentType);
  if (isVideoTypeSupported) {
    if (urlToLoad) {
      if (renderedRef?.current?.paused) {
        setTimeout(() => {
          try {
            void renderedRef?.current?.play();
          } catch (e) {
            window.log.error('Failed to play video', e.message);
          }
        }, 50);
      }
    }

    return (
      <video role="button" ref={renderedRef} controls={true} style={styles.object} key={urlToLoad}>
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
  const renderedRef = useRef<HTMLElement>(null);
  const dispatch = getAppDispatch();
  const { caption, contentType, objectURL, onNext, onPrevious, onSave, onClose } = props;

  const onObjectClick = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    dispatch(updateLightBoxOptions(null));
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    dispatch(updateLightBoxOptions(null));
  };

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const onContainerClick = (event: MouseEvent<HTMLDivElement>) => {
    if (renderedRef && event.target === renderedRef.current) {
      return;
    }
    handleClose();
  };

  return (
    <SessionFocusTrap
      focusTrapId="Lightbox"
      initialFocus={() => {
        return closeButtonRef.current;
      }}
      returnFocusOnDeactivate={false}
    >
      <div style={styles.container} role="dialog" onClick={onContainerClick}>
        <div style={styles.mainContainer}>
          <div style={styles.controlsOffsetPlaceholder} />
          <div style={styles.objectParentContainer} role="button">
            <div style={styles.objectContainer}>
              {!isUndefined(contentType) ? (
                <LightboxObject
                  objectURL={objectURL}
                  contentType={contentType}
                  renderedRef={renderedRef}
                  onObjectClick={onObjectClick}
                />
              ) : null}
              {caption ? <div style={styles.caption}>{caption}</div> : null}
            </div>
          </div>
          <div style={styles.controls}>
            <Flex $container={true}>
              <IconButton
                unicode={LUCIDE_ICONS_UNICODE.X}
                onClick={handleClose}
                ref={closeButtonRef}
              />
            </Flex>

            {onSave ? (
              <IconButton
                unicode={LUCIDE_ICONS_UNICODE.ARROW_DOWN_TO_LINE}
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
    </SessionFocusTrap>
  );
};
