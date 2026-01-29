import { isEmpty } from 'lodash';
import styled from 'styled-components';
import { assertUnreachable } from '../../../../types/sqlSharedTypes';
import { Flex } from '../../../basic/Flex';
import { ReadableMessage } from './ReadableMessage';
import {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../../../../interactions/types';
import {
  useSelectedConversationKey,
  useSelectedIsPrivate,
  useSelectedIsPublic,
} from '../../../../state/selectors/selectedConversation';
import { useMessageInteractionNotification, useMessageIsUnread } from '../../../../state/selectors';
import type { WithMessageId } from '../../../../session/types/with';
import { tr } from '../../../../localization/localeTools';
import { useConversationUsernameWithFallback } from '../../../../hooks/useParamSelector';

const StyledFailText = styled.div`
  color: var(--danger-color);
`;

export const InteractionNotification = (props: WithMessageId) => {
  const { messageId } = props;

  const convoId = useSelectedConversationKey();
  const displayName = useConversationUsernameWithFallback(true, convoId);
  const isGroup = !useSelectedIsPrivate();
  const isCommunity = useSelectedIsPublic();
  const isUnread = useMessageIsUnread(messageId) || false;
  const interactionNotification = useMessageInteractionNotification(messageId);

  if (!convoId || !messageId || !interactionNotification) {
    return null;
  }
  const { interactionStatus, interactionType } = interactionNotification;

  // NOTE at this time we don't show visible control messages in communities, that might change in future...
  if (isCommunity) {
    return null;
  }

  if (interactionStatus !== ConversationInteractionStatus.Error) {
    // NOTE For now we only show interaction errors in the message history
    return null;
  }

  let text = '';

  switch (interactionType) {
    case ConversationInteractionType.Leave:
      text = isCommunity
        ? tr('communityLeaveError', {
            community_name: displayName || tr('communityUnknown'),
          })
        : isGroup
          ? tr('groupLeaveErrorFailed', {
              group_name: displayName || tr('groupUnknown'),
            })
          : ''; // we cannot fail to do other actions, so not printing anything
      break;
    default:
      assertUnreachable(
        interactionType,
        `InteractionErrorMessage: Missing case error "${interactionType}"`
      );
  }

  if (isEmpty(text)) {
    return null;
  }

  return (
    <ReadableMessage
      messageId={messageId}
      isUnread={isUnread}
      key={`readable-message-${messageId}`}
      dataTestId="interaction-notification"
    >
      <Flex
        id={`convo-interaction-${convoId}`}
        $container={true}
        $flexDirection="row"
        $alignItems="center"
        $justifyContent="center"
        $margin={'var(--margins-md) var(--margins-sm)'}
        data-testid="control-message"
      >
        <StyledFailText>{text}</StyledFailText>
      </Flex>
    </ReadableMessage>
  );
};
