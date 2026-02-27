import { useConversationUsernameWithFallback } from '../../../../hooks/useParamSelector';
import type { WithContextMenuId, WithMessageId } from '../../../../session/types/with';
import { useMessageAuthorIsUs } from '../../../../state/selectors';
import { useSelectedConversationKey } from '../../../../state/selectors/selectedConversation';
import { Flex } from '../../../basic/Flex';
import { Localizer } from '../../../basic/Localizer';
import { SpacerSM, TextWithChildren } from '../../../basic/Text';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';

export const MessageRequestResponse = ({
  messageId,
  contextMenuId,
}: WithMessageId & WithContextMenuId) => {
  const conversationId = useSelectedConversationKey();
  const isUs = useMessageAuthorIsUs(messageId);

  const name = useConversationUsernameWithFallback(true, conversationId);

  if (!conversationId || !messageId) {
    return null;
  }

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      contextMenuId={contextMenuId}
      dataTestId="message-request-response-message"
      key={`readable-message-${messageId}`}
    >
      <Flex
        $container={true}
        $flexDirection="row"
        $alignItems="center"
        $justifyContent="center"
        $margin={'var(--margins-sm)'}
        id={`msg-${messageId}`}
      >
        <SpacerSM />
        <TextWithChildren $subtle={true} $ellipsisOverflow={false} $textAlign="center">
          {isUs ? (
            <Localizer token="messageRequestYouHaveAccepted" name={name} />
          ) : (
            <Localizer token="messageRequestsAccepted" />
          )}
        </TextWithChildren>
      </Flex>
    </ExpirableReadableMessage>
  );
};
