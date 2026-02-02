import { isEmpty } from 'lodash';
import { useEffect, useState } from 'react';

import styled from 'styled-components';
import { useHasUnread, useIsPrivate, useIsPublic } from '../../../hooks/useParamSelector';

import { ConvoHub } from '../../../session/conversations';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { MessageBody } from '../../conversation/message/message-content/MessageBody';
import {
  ConversationInteractionType,
  ConversationInteractionStatus,
} from '../../../interactions/types';
import { LastMessageType } from '../../../state/ducks/types';
import { tr } from '../../../localization/localeTools';
import { getStyleForMessageItemText } from './MessageItem';
import { useSelectedConversationKey } from '../../../state/selectors/selectedConversation';

const StyledInteractionItemText = styled.div<{ $isError: boolean }>`
  ${props => props.$isError && 'color: var(--danger-color) !important;'}
`;

type InteractionItemProps = {
  conversationId: string;
  lastMessage: LastMessageType | null;
};

export const InteractionItem = (props: InteractionItemProps) => {
  const { conversationId, lastMessage } = props;
  const isGroup = !useIsPrivate(conversationId);
  const isCommunity = useIsPublic(conversationId);

  const hasUnread = useHasUnread(conversationId);
  const isSelectedConvo = useSelectedConversationKey() === conversationId;

  const [storedLastMessageText, setStoredLastMessageText] = useState(lastMessage?.text);
  const [storedLastMessageInteractionStatus, setStoredLastMessageInteractionStatus] = useState(
    lastMessage?.interactionStatus
  );

  // NOTE we want to reset the interaction state when the last message changes
  useEffect(() => {
    if (conversationId) {
      const convo = ConvoHub.use().get(conversationId);

      if (
        convo &&
        storedLastMessageInteractionStatus !== convo.get('lastMessageInteractionStatus')
      ) {
        setStoredLastMessageInteractionStatus(convo.get('lastMessageInteractionStatus'));
        setStoredLastMessageText(convo.get('lastMessage'));
      }
    }
  }, [conversationId, storedLastMessageInteractionStatus]);

  if (!lastMessage) {
    return null;
  }

  const { interactionType, interactionStatus } = lastMessage || {};

  if (!interactionType || !interactionStatus) {
    return null;
  }

  let text = storedLastMessageText || '';
  let errorText = '';

  const name = ConvoHub.use().get(conversationId)?.getNicknameOrRealUsernameOrPlaceholder();

  switch (interactionType) {
    case ConversationInteractionType.Leave:
      errorText = isCommunity
        ? tr('communityLeaveError', {
            community_name: name || tr('unknown'),
          })
        : isGroup
          ? tr('groupLeaveErrorFailed', { group_name: name })
          : ''; // this cannot happen
      text =
        interactionStatus === ConversationInteractionStatus.Error
          ? errorText
          : interactionStatus === ConversationInteractionStatus.Start ||
              interactionStatus === ConversationInteractionStatus.Loading
            ? tr('leaving')
            : text;
      break;
    default:
      assertUnreachable(
        interactionType,
        `InteractionItem: Missing case error "${interactionType}"`
      );
  }

  if (isEmpty(text)) {
    return null;
  }

  return (
    <div className="module-conversation-list-item__message">
      <StyledInteractionItemText
        $isError={Boolean(interactionStatus === ConversationInteractionStatus.Error)}
        style={getStyleForMessageItemText(hasUnread, isSelectedConvo)}
      >
        <MessageBody
          text={text}
          disableJumbomoji={true}
          disableRichContent={true}
          isGroup={isGroup}
          isPublic={isCommunity}
        />
      </StyledInteractionItemText>
    </div>
  );
};
