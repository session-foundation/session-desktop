import { useRef } from 'react';
import styled from 'styled-components';
import useKey from 'react-use/lib/useKey';
import * as GoogleChrome from '../util/GoogleChrome';

import { AttachmentType } from '../types/Attachment';
import { AriaLabels } from '../util/hardcodedAriaLabels';
import { LUCIDE_ICONS_UNICODE } from './icon/lucide';
import { SessionLucideIconButton } from './icon/SessionIconButton';
import { SessionFocusTrap } from './SessionFocusTrap';
import type { OutgoingLightBoxOptions } from '../state/ducks/modalDialog';

type Props = {
  attachment: AttachmentType;
  url: string;
  onClose: () => void;
};

const StyledCaptionEditorImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;

  flex-grow: 1;
  flex-shrink: 1;
`;

const StyledCaptionEditorVideo = styled.video`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;

  flex-grow: 1;
  flex-shrink: 1;
`;

const StyledCaptionEditorPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  object-fit: contain;

  flex-grow: 1;
  flex-shrink: 1;
`;

const LightboxObject = (props: Props) => {
  const { url, onClose, attachment } = props;
  const { contentType } = attachment || { contentType: null };

  const isImageTypeSupported = GoogleChrome.isImageTypeSupported(contentType);
  if (isImageTypeSupported) {
    return (
      <StyledCaptionEditorImage src={url} onClick={onClose} alt={AriaLabels.imageAttachmentAlt} />
    );
  }

  const isVideoTypeSupported = GoogleChrome.isVideoTypeSupported(contentType);
  if (isVideoTypeSupported) {
    return (
      <StyledCaptionEditorVideo controls={true}>
        <source src={url} />
      </StyledCaptionEditorVideo>
    );
  }

  return <StyledCaptionEditorPlaceholder />;
};

const StyledCaptionEditorContainer = styled.div`
  flex-grow: 1;
  flex-shrink: 1;
  text-align: center;
  margin: 50px;
  overflow: hidden;
  height: 100%;
`;

const StyledCaptionEditor = styled.div`
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 20;

  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;

  display: flex;
  flex-direction: column;
  height: 100%;

  .session-button {
    margin-inline-start: 15px;
  }
`;

/**
 * This actually no longer allows to edit the caption as we do not support this feature anymore.
 * This is just a lightbox to preview the attachments before sending them in a message
 */
export const OutgoingLightBox = (props: NonNullable<OutgoingLightBoxOptions>) => {
  const { onClose } = props;
  const ref = useRef<HTMLButtonElement>(null);

  useKey('Escape', onClose);

  return (
    <SessionFocusTrap initialFocus={() => ref.current} allowOutsideClick={true}>
      <StyledCaptionEditor>
        <SessionLucideIconButton
          iconSize="huge"
          iconColor="var(--white-color)"
          unicode={LUCIDE_ICONS_UNICODE.X}
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 'var(--margins-sm)',
            right: 'var(--margins-sm)',
            zIndex: 1,
          }}
          ref={ref}
        />
        <StyledCaptionEditorContainer>
          <LightboxObject {...props} />
        </StyledCaptionEditorContainer>
      </StyledCaptionEditor>
    </SessionFocusTrap>
  );
};
