import styled from 'styled-components';
import { MessageRenderingProps } from '../../../../models/messageType';
import {
  useLastMessageOfSeries,
  useMessageAuthor,
  useMessageSenderIsAdmin,
} from '../../../../state/selectors';
import { Avatar, AvatarSize } from '../../../avatar/Avatar';
import { useShowUserDetailsCbFromMessage } from '../../../menuAndSettingsHooks/useShowUserDetailsCb';

const StyledAvatar = styled.div`
  position: relative;
  margin-inline-end: 10px;
  max-width: var(
    --width-avatar-group-msg-list
  ); // enforcing this so we change the variable when changing the content of the avatar
  overflow-y: hidden;
`;

export type MessageAvatarSelectorProps = Pick<
  MessageRenderingProps,
  'sender' | 'isSenderAdmin' | 'lastMessageOfSeries'
>;

type Props = { messageId: string; isPrivate: boolean };

export const MessageAvatar = (props: Props) => {
  const { messageId, isPrivate } = props;

  const sender = useMessageAuthor(messageId);
  const lastMessageOfSeries = useLastMessageOfSeries(messageId);
  const isSenderAdmin = useMessageSenderIsAdmin(messageId);

  const showUserDetailsCb = useShowUserDetailsCbFromMessage();

  if (!sender) {
    return null;
  }

  if (isPrivate) {
    return null;
  }

  if (!lastMessageOfSeries) {
    return <div style={{ marginInlineEnd: 'var(--width-avatar-group-msg-list)' }} />;
  }
  // The styledAvatar, when rendered needs to have a width with margins included of var(--width-avatar-group-msg-list).
  // This is so that the other message is still aligned when the avatar is not rendered (we need to make up for the space used by the avatar, and we use a margin of width-avatar-group-msg-list)
  return (
    <StyledAvatar>
      <Avatar
        size={AvatarSize.S}
        onAvatarClick={() => {
          void showUserDetailsCb({ messageId });
        }}
        pubkey={sender}
        showCrown={isSenderAdmin}
      />
    </StyledAvatar>
  );
};
