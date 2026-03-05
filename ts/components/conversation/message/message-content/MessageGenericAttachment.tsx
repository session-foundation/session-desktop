import styled from 'styled-components';
import clsx from 'clsx';

import type { MouseEvent, KeyboardEvent } from 'react';
import { PropsForAttachment } from '../../../../state/ducks/conversations';
import { AttachmentTypeWithPath } from '../../../../types/Attachment';
import { Spinner } from '../../../loading';
import { MessageModelType } from '../../../../models/messageType';
import { LucideIcon } from '../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { MessageHighlighter } from './MessageHighlighter';
import { getShortenedFilename } from './quote/QuoteText';
import { createButtonOnKeyDownForClickEventHandler } from '../../../../util/keyboardShortcuts';

const StyledGenericAttachmentContainer = styled.div<{
  selected: boolean;
}>`
  ${props => props.selected && 'box-shadow: var(--drop-shadow);'}
`;

export function MessageGenericAttachment({
  attachment,
  /** comes from the attachment itself or the component if it needs to be decrypted */
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
  onClick?: (e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => void;
}) {
  const { fileName, fileSize } = attachment;

  const shortenedFilename = getShortenedFilename(fileName);
  const onKeyDown = onClick ? createButtonOnKeyDownForClickEventHandler(onClick) : undefined;

  return (
    <MessageHighlighter $highlight={highlight} onClick={onClick} onKeyDown={onKeyDown} tabIndex={0}>
      <StyledGenericAttachmentContainer
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
                ? 'var(--message-bubble-incoming-text-color)'
                : 'var(--message-bubble-outgoing-text-color)'
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
            {shortenedFilename}
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
    </MessageHighlighter>
  );
}
