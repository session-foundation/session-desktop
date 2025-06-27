import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import clsx from 'clsx';

import { isNumber } from 'lodash';
import { useDisableDrag } from '../../hooks/useDisableDrag';
import { AttachmentType, AttachmentTypeWithPath } from '../../types/Attachment';
import { Spinner } from '../loading';
import { MessageGenericAttachment } from './message/message-content/MessageGenericAttachment';
import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';
import { useMessageIdFromContext } from '../../contexts/MessageIdContext';
import { useMessageDirection, useMessageSelected } from '../../state/selectors';
import { PlayButtonCenteredAbsolute } from '../buttons/PlayButton';
import { StagedAttachmentsCloseButton } from './StagedAttachementsCloseButton';

type Props = {
  alt: string;
  attachment: AttachmentTypeWithPath | AttachmentType;
  /** undefined if the message is not visible yet, '' if the attachment is broken */
  url: string | undefined;
  imageBroken?: boolean;

  height?: number | string;
  width?: number | string;

  overlayText?: string;

  closeButton?: boolean;

  darkOverlay?: boolean;
  playIconOverlay?: boolean;
  softCorners: boolean;
  forceSquare?: boolean;
  attachmentIndex?: number;
  highlight?: boolean;

  onClick?: (attachment: AttachmentTypeWithPath | AttachmentType) => void;
  onClickClose?: (attachment: AttachmentTypeWithPath | AttachmentType) => void;
  onError?: () => void;
};

const StyledOverlay = styled.div<Pick<Props, 'darkOverlay' | 'softCorners'>>`
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  left: 0;
  right: 0;
  background-color: ${props =>
    props.darkOverlay ? 'var(--message-link-preview-background-color)' : 'unset'};
`;
export const Image = (props: Props) => {
  const {
    alt,
    attachment,
    imageBroken,
    closeButton,
    darkOverlay,
    height: _height,
    onClick,
    onClickClose,
    onError,
    overlayText,
    playIconOverlay,
    softCorners,
    forceSquare,
    attachmentIndex,
    highlight,
    url,
    width: _width,
  } = props;

  const messageId = useMessageIdFromContext();
  const dropShadow = useMessageSelected(messageId);
  const direction = useMessageDirection(messageId);

  const disableDrag = useDisableDrag();
  const { loading, urlToLoad } = useEncryptedFileFetch(url, attachment.contentType, false);

  const [pending, setPending] = useState(attachment.pending ?? true);
  const [mounted, setMounted] = useState((!loading || !pending) && urlToLoad === undefined);

  const canClick = onClick && !pending;
  const role = canClick ? 'button' : undefined;

  const onErrorUrlFiltering = useCallback(() => {
    if (mounted && url && urlToLoad === '' && onError) {
      onError();
      setPending(false);
    }
  }, [mounted, onError, url, urlToLoad]);

  const width = isNumber(_width) ? `${_width}px` : _width;
  const height = isNumber(_height) ? `${_height}px` : _height;

  useEffect(() => {
    if (mounted && url === '') {
      setPending(false);
      onErrorUrlFiltering();
    }

    if (mounted && imageBroken && urlToLoad === '') {
      setPending(false);
      onErrorUrlFiltering();
    }

    if (url) {
      setPending(false);
      setMounted(!loading && !pending);
    }
  }, [imageBroken, loading, mounted, onErrorUrlFiltering, pending, url, urlToLoad]);

  if (mounted && imageBroken) {
    return (
      <MessageGenericAttachment
        attachment={attachment as AttachmentTypeWithPath}
        pending={false}
        highlight={!!highlight}
        selected={!!dropShadow} // dropshadow is selected
        direction={direction}
      />
    );
  }

  return (
    <div
      role={role}
      onClick={(e: any) => {
        if (canClick && onClick) {
          e.stopPropagation();
          onClick(attachment);
        }
      }}
      className={clsx(
        'module-image',
        canClick ? 'module-image__with-click-handler' : null,
        softCorners ? 'module-image--soft-corners' : null
      )}
      style={{
        maxHeight: height,
        maxWidth: width,
        minHeight: height,
        minWidth: width,
        boxShadow: dropShadow ? 'var(--drop-shadow)' : undefined,
      }}
      data-attachmentindex={attachmentIndex}
    >
      {!mounted || !urlToLoad ? (
        <div
          className="module-image__loading-placeholder"
          style={{
            maxHeight: height,
            maxWidth: width,
            width,
            height,
            lineHeight: height,
            textAlign: 'center',
          }}
        >
          <Spinner size="normal" />
        </div>
      ) : (
        <img
          onError={onErrorUrlFiltering}
          className={clsx('module-image__image', forceSquare ? 'module-image__image-cover' : '')}
          alt={alt}
          style={{
            maxHeight: height,
            maxWidth: width,
            minHeight: height,
            minWidth: width,
            width: forceSquare ? width : '',
            height: forceSquare ? height : '',
          }}
          src={urlToLoad}
          onDragStart={disableDrag}
        />
      )}

      <StyledOverlay
        className={clsx(softCorners ? 'module-image--soft-corners' : null)}
        darkOverlay={darkOverlay}
        softCorners={softCorners}
      />
      {closeButton ? (
        <StagedAttachmentsCloseButton
          onClick={() => {
            onClickClose?.(attachment);
          }}
        />
      ) : null}
      {mounted && playIconOverlay ? <PlayButtonCenteredAbsolute iconSize="huge" /> : null}
      {overlayText ? (
        <div className="module-image__text-container" style={{ lineHeight: height }}>
          {overlayText}
        </div>
      ) : null}
    </div>
  );
};
