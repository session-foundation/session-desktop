import * as GoogleChrome from '../util/GoogleChrome';

import { AttachmentType } from '../types/Attachment';
import { AriaLabels } from '../util/hardcodedAriaLabels';
import { LUCIDE_ICONS_UNICODE } from './icon/lucide';
import { SessionLucideIconButton } from './icon/SessionIconButton';

type Props = {
  attachment: AttachmentType;
  url: string;
  caption?: string;
  onSave: (caption: string) => void;
  onClose: () => void;
};

const CaptionEditorObject = (props: Props) => {
  const { url, onClose, attachment } = props;
  const { contentType } = attachment || { contentType: null };

  const isImageTypeSupported = GoogleChrome.isImageTypeSupported(contentType);
  if (isImageTypeSupported) {
    return (
      <img
        className="module-caption-editor__image"
        src={url}
        onClick={onClose}
        alt={AriaLabels.imageAttachmentAlt}
      />
    );
  }

  const isVideoTypeSupported = GoogleChrome.isVideoTypeSupported(contentType);
  if (isVideoTypeSupported) {
    return (
      <video className="module-caption-editor__video" controls={true}>
        <source src={url} />
      </video>
    );
  }

  return <div className="module-caption-editor__placeholder" />;
};

/**
 * This actually no longer allows to edit the caption as we do not support this feature anymore.
 * This is just a lightbox to preview the attachments before sending them in a message
 */
export const CaptionEditor = (props: Props) => {
  const { onClose } = props;

  return (
    <div role="dialog" className="module-caption-editor">
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
      />
      <div className="module-caption-editor__media-container">
        <CaptionEditorObject {...props} />
      </div>
    </div>
  );
};
