import { useSelector } from 'react-redux';
import { callRecipient } from '../../../interactions/conversationInteractions';
import { getHasIncomingCall, getHasOngoingCall } from '../../../state/selectors/call';

import {
  useSelectedConversationKey,
  useSelectedIsActive,
  useSelectedIsApproved,
  useSelectedIsBlocked,
  useSelectedIsNoteToSelf,
  useSelectedIsPrivate,
  useSelectedIsPrivateFriend,
  useSelectedIsPublic,
} from '../../../state/selectors/selectedConversation';
import { Avatar, AvatarSize } from '../../avatar/Avatar';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { useIsGroupV2, useIsLegacyGroup } from '../../../hooks/useParamSelector';
import { useLibGroupInvitePending } from '../../../state/selectors/userGroups';

export const AvatarHeader = (props: { pubkey: string; onAvatarClick?: () => void }) => {
  const { pubkey, onAvatarClick } = props;
  const isApproved = useSelectedIsApproved();

  const isLegacyGroup = useIsLegacyGroup(pubkey);
  const invitePending = useLibGroupInvitePending(pubkey);
  const isPrivate = useSelectedIsPrivate();
  const isGroupV2 = useIsGroupV2(pubkey);

  const isPublic = useSelectedIsPublic();

  const canClickLegacy = isLegacyGroup && false; // we can never click the avatar if it's a legacy group
  const canClickPrivateApproved = isApproved && isPrivate; // we can only click the avatar if it's a private and approved conversation
  const canClick03GroupAccepted = isGroupV2 && !invitePending; // we can only click the avatar if it's a group and have accepted the invite already
  const canClickCommunity = isPublic; // we can always click the settings for a community (even if we are not an admin)

  const optOnAvatarClick =
    canClickLegacy || canClickPrivateApproved || canClick03GroupAccepted || canClickCommunity
      ? onAvatarClick
      : undefined;

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
    !isActive ||
    !isPrivateAndFriend // call requires us to be friends
  ) {
    return null;
  }

  return (
    <SessionLucideIconButton
      unicode={LUCIDE_ICONS_UNICODE.PHONE}
      iconSize="large"
      onClick={() => {
        void callRecipient(selectedConvoKey, canCall);
      }}
      dataTestId="call-button"
      margin="0 var(--margins-sm) 0 0"
      disabled={isBlocked || !canCall}
    />
  );
};
