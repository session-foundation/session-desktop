import styled from 'styled-components';
import clsx from 'clsx';

import { PropsForAttachment } from '../../../../state/ducks/conversations';
import { AttachmentTypeWithPath } from '../../../../types/Attachment';
import { Spinner } from '../../../loading';
import { MessageModelType } from '../../../../models/messageType';
import { MessageHighlighter } from './MessageHighlighter';
import { LucideIcon } from '../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';

const StyledGenericAttachmentContainer = styled(MessageHighlighter)<{
  highlight: boolean;
  selected: boolean;
}>`
  ${props => props.selected && 'box-shadow: var(--drop-shadow);'}
`;

export function MessageGenericAttachment({
  attachment,
  /** comes from the attachment iself or the component if it needs to be decrypted */
  pending,
  selected,
  highlight,
  direction,
  onClick,
}: {
  attachment: PropsForAttachment | AttachmentTypeWithPath;
  pending: boolean;
  selected: boolean;
  highlight: boolean;
  direction?: MessageModelType;
  onClick?: (e: any) => void;
}) {
  const { fileName, fileSize } = attachment;

  return (
    <StyledGenericAttachmentContainer
      highlight={highlight}
      selected={selected}
      className={'module-message__generic-attachment'}
      onClick={onClick}
    >
      {pending ? (
        <div className="module-message__generic-attachment__spinner-container">
          <Spinner size="small" />
        </div>
      ) : (
        <LucideIcon
          iconSize="medium"
          unicode={LUCIDE_ICONS_UNICODE.FILE}
          iconColor={
            direction === 'incoming'
              ? 'var(--message-bubbles-received-text-color)'
              : 'var(--message-bubbles-sent-text-color)'
          }
        />
      )}
      <div className="module-message__generic-attachment__text">
        <div
          className={clsx(
            'module-message__generic-attachment__file-name',
            `module-message__generic-attachment__file-name--${direction}`
          )}
        >
          {fileName}
        </div>
        <div
          className={clsx(
            'module-message__generic-attachment__file-size',
            `module-message__generic-attachment__file-size--${direction}`
          )}
        >
          {fileSize}
        </div>
      </div>
    </StyledGenericAttachmentContainer>
  );
}
