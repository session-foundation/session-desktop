import { AttachmentType, getExtensionForDisplay } from '../../types/Attachment';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { SessionLucideIconButton } from '../icon/SessionIconButton';

type Props = {
  attachment: AttachmentType;
  onClose: (attachment: AttachmentType) => void;
};

export function StagedGenericAttachment(props: Props) {
  const { attachment, onClose } = props;
  const { fileName, contentType } = attachment;
  const extension = getExtensionForDisplay({ contentType, fileName });

  return (
    <div className="module-staged-generic-attachment">
      <SessionLucideIconButton
        iconSize="huge"
        iconColor="var(--black-color)"
        unicode={LUCIDE_ICONS_UNICODE.X}
        onClick={() => {
          onClose?.(attachment);
        }}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          zIndex: 1,
        }}
      />
      <div className="module-staged-generic-attachment__icon">
        {extension ? (
          <div className="module-staged-generic-attachment__icon__extension">{extension}</div>
        ) : null}
      </div>
      <div className="module-staged-generic-attachment__filename">{fileName}</div>
    </div>
  );
}
