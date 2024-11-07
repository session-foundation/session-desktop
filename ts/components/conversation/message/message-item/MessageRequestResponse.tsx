import { useNicknameOrProfileNameOrShortenedPubkey } from '../../../../hooks/useParamSelector';
import { PropsForMessageRequestResponse } from '../../../../models/messageType';
import { UserUtils } from '../../../../session/utils';
import { Flex } from '../../../basic/Flex';
import { Localizer } from '../../../basic/Localizer';
import { SpacerSM, TextWithChildren } from '../../../basic/Text';
import { ReadableMessage } from './ReadableMessage';

// Note this should not respond to the disappearing message conversation setting so we use the ReadableMessage
export const MessageRequestResponse = (props: PropsForMessageRequestResponse) => {
  const { messageId, isUnread, receivedAt, conversationId } = props;

  const name = useNicknameOrProfileNameOrShortenedPubkey(conversationId);
  const isFromSync = props.source === UserUtils.getOurPubKeyStrFromCache();

  return (
    <ReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={isUnread}
      dataTestId="message-request-response-message"
      key={`readable-message-${messageId}`}
    >
      <Flex
        container={true}
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        margin={'var(--margins-sm)'}
        id={`msg-${messageId}`}
      >
        <SpacerSM />
        <TextWithChildren subtle={true} ellipsisOverflow={false} textAlign="center">
          {isFromSync ? (
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
