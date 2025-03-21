import { useNicknameOrProfileNameOrShortenedPubkey } from '../../../../hooks/useParamSelector';
import type { WithMessageId } from '../../../../session/types/with';
import { useMessageAuthorIsUs, useMessageIsUnread } from '../../../../state/selectors';
import { useSelectedConversationKey } from '../../../../state/selectors/selectedConversation';
import { Flex } from '../../../basic/Flex';
import { Localizer } from '../../../basic/Localizer';
import { SpacerSM, TextWithChildren } from '../../../basic/Text';
import { ReadableMessage } from './ReadableMessage';

// Note: this should not respond to the disappearing message conversation setting so we use the ReadableMessage directly
export const MessageRequestResponse = ({ messageId }: WithMessageId) => {
  const conversationId = useSelectedConversationKey();
  const isUnread = useMessageIsUnread(messageId) || false;
  const isUs = useMessageAuthorIsUs(messageId);

  const name = useNicknameOrProfileNameOrShortenedPubkey(conversationId);

  if (!conversationId || !messageId) {
    return null;
  }

  return (
    <ReadableMessage
      messageId={messageId}
      isUnread={isUnread}
      dataTestId="message-request-response-message"
      key={`readable-message-${messageId}`}
    >
      <Flex
        $container={true}
        $flexDirection="row"
        $alignItems="center"
        $justifyContent="center"
        margin={'var(--margins-sm)'}
        id={`msg-${messageId}`}
      >
        <SpacerSM />
        <TextWithChildren subtle={true} ellipsisOverflow={false} textAlign="center">
          {isUs ? (
            <Localizer
              token="messageRequestYouHaveAccepted"
              args={{
                name,
              }}
            />
          ) : (
            <Localizer token="messageRequestsAccepted" />
          )}
        </TextWithChildren>
      </Flex>
    </ReadableMessage>
  );
};
