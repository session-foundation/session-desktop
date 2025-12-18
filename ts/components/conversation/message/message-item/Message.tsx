import { GenericReadableMessage } from './GenericReadableMessage';

type Props = {
  messageId: string;
};

export const Message = (props: Props) => {
  const ctxMenuID = `ctx-menu-message-${props.messageId}`;

  return <GenericReadableMessage ctxMenuID={ctxMenuID} messageId={props.messageId} />;
};
