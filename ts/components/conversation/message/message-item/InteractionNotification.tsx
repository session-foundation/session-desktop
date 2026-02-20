import { isEmpty } from 'lodash';
import styled from 'styled-components';
import { assertUnreachable } from '../../../../types/sqlSharedTypes';
import { Flex } from '../../../basic/Flex';
import {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../../../../interactions/types';
import {
  useSelectedConversationKey,
  useSelectedIsPrivate,
  useSelectedIsPublic,
} from '../../../../state/selectors/selectedConversation';
import { useMessageInteractionNotification } from '../../../../state/selectors';
import type { WithContextMenuId, WithMessageId } from '../../../../session/types/with';
import { tr } from '../../../../localization/localeTools';
import { useConversationUsernameWithFallback } from '../../../../hooks/useParamSelector';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';
import type { WithPopoverPosition, WithSetPopoverPosition } from '../../../SessionTooltip';

const StyledFailText = styled.div`
  color: var(--danger-color);
`;

export const InteractionNotification = (
  props: WithMessageId & WithPopoverPosition & WithSetPopoverPosition & WithContextMenuId
) => {
  const { messageId } = props;

  const convoId = useSelectedConversationKey();
  const displayName = useConversationUsernameWithFallback(true, convoId);
  const isGroup = !useSelectedIsPrivate();
  const isCommunity = useSelectedIsPublic();
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
    <ExpirableReadableMessage
      messageId={messageId}
      contextMenuId={props.contextMenuId}
      setTriggerPosition={props.setTriggerPosition}
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
    </ExpirableReadableMessage>
  );
};
