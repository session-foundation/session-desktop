import { AttachmentType, getExtensionForDisplay } from '../../types/Attachment';
import { StagedAttachmentsCloseButton } from './StagedAttachementsCloseButton';

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
      <StagedAttachmentsCloseButton
        onClick={() => {
          onClose?.(attachment);
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
