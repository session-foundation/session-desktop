import styled from 'styled-components';
import {
  useFirstMessageOfSeries,
  useHideAvatarInMsgList,
  useMessageAuthor,
  useMessageDirection,
} from '../../../../state/selectors';
import {
  useSelectedConversationKey,
  useSelectedIsGroupOrCommunity,
} from '../../../../state/selectors/selectedConversation';
import { Flex } from '../../../basic/Flex';
import { ContactName } from '../../ContactName/ContactName';
import { useShowUserDetailsCbFromMessage } from '../../../menuAndSettingsHooks/useShowUserDetailsCb';

type Props = {
  messageId: string;
};

const StyledAuthorContainer = styled(Flex)<{ $hideAvatar: boolean }>`
  color: var(--text-primary-color);
  text-overflow: ellipsis;
  margin-inline-start: ${props => (props.$hideAvatar ? 0 : 'var(--width-avatar-group-msg-list)')};
`;

export const MessageAuthorText = ({ messageId }: Props) => {
  const isGroup = useSelectedIsGroupOrCommunity();
  const sender = useMessageAuthor(messageId);
  const direction = useMessageDirection(messageId);
  const firstMessageOfSeries = useFirstMessageOfSeries(messageId);
  const hideAvatar = useHideAvatarInMsgList(messageId);
  const showUserDetailsCb = useShowUserDetailsCbFromMessage();
  const conversationId = useSelectedConversationKey();

  if (!messageId || !sender || !direction) {
    return null;
  }

  if (direction !== 'incoming' || !isGroup || !firstMessageOfSeries) {
    return null;
  }

  return (
    <StyledAuthorContainer
      $container={true}
      $hideAvatar={hideAvatar}
      onClick={() => {
        void showUserDetailsCb({ messageId });
      }}
      style={{ cursor: 'pointer' }}
    >
      <ContactName
        pubkey={sender}
        module="module-message__author"
        contactNameContext="message-author"
        conversationId={conversationId}
      />
    </StyledAuthorContainer>
  );
};
