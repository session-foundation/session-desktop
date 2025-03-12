import { v4 as uuidv4 } from 'uuid';
import { THUMBNAIL_SIDE } from '../../../../types/attachments/VisualAttachment';
import { GenericReadableMessage } from './GenericReadableMessage';

// Same as MIN_WIDTH in ImageGrid.tsx
export const MINIMUM_LINK_PREVIEW_IMAGE_WIDTH = THUMBNAIL_SIDE;

type Props = {
  messageId: string;
};

export const Message = (props: Props) => {
  // FIXME this should probably just be something static per message.
  const ctxMenuID = `ctx-menu-message-${uuidv4()}`;

  return <GenericReadableMessage ctxMenuID={ctxMenuID} messageId={props.messageId} />;
};
