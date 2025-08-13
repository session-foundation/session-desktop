import { v4 as uuidv4 } from 'uuid';
import { GenericReadableMessage } from './GenericReadableMessage';

type Props = {
  messageId: string;
};

export const Message = (props: Props) => {
  // FIXME this should probably just be something static per message.
  const ctxMenuID = `ctx-menu-message-${uuidv4()}`;

  return <GenericReadableMessage ctxMenuID={ctxMenuID} messageId={props.messageId} />;
};
