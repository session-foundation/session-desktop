import { useSelector } from 'react-redux';
import { callRecipient } from '../../../interactions/conversationInteractions';
import { getHasIncomingCall, getHasOngoingCall } from '../../../state/selectors/call';

import {
  useSelectedConversationKey,
  useSelectedIsActive,
  useSelectedIsBlocked,
  useSelectedIsNoteToSelf,
  useSelectedIsPrivate,
  useSelectedIsPrivateFriend,
} from '../../../state/selectors/selectedConversation';
import { Avatar, AvatarSize } from '../../avatar/Avatar';
import { SessionIconButton } from '../../icon';
import { useIsLegacyGroup } from '../../../hooks/useParamSelector';

export const AvatarHeader = (props: { pubkey: string; onAvatarClick?: () => void }) => {
  const { pubkey, onAvatarClick } = props;

  const isLegacyGroup = useIsLegacyGroup(pubkey);

  const optOnAvatarClick = !isLegacyGroup ? onAvatarClick : undefined;

  return (
    <span className="module-conversation-header__avatar">
      <Avatar
        size={AvatarSize.S}
        onAvatarClick={optOnAvatarClick}
        pubkey={pubkey}
        dataTestId="conversation-options-avatar"
      />
    </span>
  );
};

export const BackButton = (props: { onGoBack: () => void; showBackButton: boolean }) => {
  const { onGoBack, showBackButton } = props;
  if (!showBackButton) {
    return null;
  }

  return (
    <SessionIconButton
      iconType="chevron"
      iconSize="large"
      iconRotation={90}
      onClick={onGoBack}
      dataTestId="back-button-message-details"
    />
  );
};

export const CallButton = () => {
  const isPrivate = useSelectedIsPrivate();
  const isBlocked = useSelectedIsBlocked();
  const isActive = useSelectedIsActive();
  const isMe = useSelectedIsNoteToSelf();
  const selectedConvoKey = useSelectedConversationKey();

  const hasIncomingCall = useSelector(getHasIncomingCall);
  const hasOngoingCall = useSelector(getHasOngoingCall);
  const canCall = !(hasIncomingCall || hasOngoingCall);

  const isPrivateAndFriend = useSelectedIsPrivateFriend();

  if (
    !isPrivate ||
    isMe ||
    !selectedConvoKey ||
    isBlocked ||
    !isActive ||
    !isPrivateAndFriend // call requires us to be friends
  ) {
    return null;
  }

  return (
    <SessionIconButton
      iconType="phone"
      iconSize="large"
      iconPadding="2px"
      // negative margin to keep conversation header title centered
      margin="0 10px 0 -32px"
      onClick={() => {
        void callRecipient(selectedConvoKey, canCall);
      }}
      dataTestId="call-button"
    />
  );
};
