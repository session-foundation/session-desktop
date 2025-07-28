import styled from 'styled-components';
import { PubKey } from '../../../../session/types';
import {
  useAuthorName,
  useAuthorProfileName,
  useFirstMessageOfSeries,
  useHideAvatarInMsgList,
  useMessageAuthor,
  useMessageDirection,
} from '../../../../state/selectors';
import {
  useSelectedIsGroupOrCommunity,
  useSelectedIsPublic,
} from '../../../../state/selectors/selectedConversation';
import { Flex } from '../../../basic/Flex';
import { ContactName } from '../../ContactName';
import { useOnMessageAvatarClickCb } from '../../../menuAndSettingsHooks/useMessageAvatarClickCb';

type Props = {
  messageId: string;
};

const StyledAuthorContainer = styled(Flex)<{ hideAvatar: boolean }>`
  color: var(--text-primary-color);
  text-overflow: ellipsis;
  margin-inline-start: ${props => (props.hideAvatar ? 0 : 'var(--width-avatar-group-msg-list)')};
`;

export const MessageAuthorText = ({ messageId }: Props) => {
  const isPublic = useSelectedIsPublic();
  const isGroup = useSelectedIsGroupOrCommunity();
  const authorProfileName = useAuthorProfileName(messageId);
  const authorName = useAuthorName(messageId);
  const sender = useMessageAuthor(messageId);
  const direction = useMessageDirection(messageId);
  const firstMessageOfSeries = useFirstMessageOfSeries(messageId);
  const hideAvatar = useHideAvatarInMsgList(messageId);
  const onMessageAvatarClick = useOnMessageAvatarClickCb();

  if (!messageId || !sender || !direction) {
    return null;
  }

  const title = authorName || sender;

  if (direction !== 'incoming' || !isGroup || !title || !firstMessageOfSeries) {
    return null;
  }

  const displayedPubkey = authorProfileName ? PubKey.shorten(sender) : sender;

  return (
    <StyledAuthorContainer
      $container={true}
      hideAvatar={hideAvatar}
      onClick={() => {
        void onMessageAvatarClick({ messageId });
      }}
      style={{ cursor: 'pointer' }}
    >
      <ContactName
        pubkey={displayedPubkey}
        name={authorName}
        profileName={authorProfileName}
        module="module-message__author"
        boldProfileName={true}
        shouldShowPubkey={Boolean(isPublic)}
      />
    </StyledAuthorContainer>
  );
};
