import styled from 'styled-components';
import { useIsClosedGroup, useSortedGroupMembers } from '../../../hooks/useParamSelector';
import { UserUtils } from '../../../session/utils';
import { MemberAvatarPlaceHolder } from '../../icon/MemberAvatarPlaceHolder';
import { Avatar, AvatarSize } from '../Avatar';
import { useAvatarBgColor } from './AvatarPlaceHolder';
import { StyledAvatar } from './StyledAvatar';

/**
 * Move our pubkey at the end of the list if we are in the list of members.
 * We do this, as we want to
 * - show 2 other members when there are enough of them,
 * - show us as the 2nd member when there are only 2 members
 * - show us first with a grey avatar as second when there are only us in the group.
 */
function moveUsAtTheEnd(members: Array<string>, us: string) {
  const usAt = members.findIndex(val => val === us);
  if (us && usAt > -1) {
    // we need to move us at the end of the array
    const updated = members.filter(m => m !== us);
    updated.push(us);
    return updated;
  }
  return members;
}

function sortAndSlice(sortedMembers: Array<string>, us: string) {
  const usAtTheEndIfNeeded = moveUsAtTheEnd(sortedMembers, us); // make sure we are not one of the first 2 members if there is enough members
  // we render at most 2 avatars for closed groups
  return { firstMember: usAtTheEndIfNeeded?.[0], secondMember: usAtTheEndIfNeeded?.[1] };
}

function useGroupMembersAvatars(convoId: string | undefined) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  const isClosedGroup = useIsClosedGroup(convoId);
  const sortedMembers = useSortedGroupMembers(convoId);

  if (!convoId || !isClosedGroup) {
    return undefined;
  }

  // for avatar purposes, we are always part of the group, even when there are no members at all
  if (!sortedMembers || sortedMembers.length < 2) {
    return { firstMember: us, secondMember: undefined };
  }

  return sortAndSlice(sortedMembers, us);
}

const StyledAvatarClosedContainer = styled.div<{ containerSize: number }>`
  width: ${({ containerSize }) => containerSize}px;
  height: ${({ containerSize }) => containerSize}px;
  mask-image: url(images/avatar-svg-mask.svg);

  .module-avatar:last-child {
    position: absolute;
    right: 0px;
    bottom: 0px;
  }
`;

export const ClosedGroupAvatar = ({
  convoId,
  size: containerSize,
  onAvatarClick,
}: {
  size: AvatarSize;
  convoId: string;
  onAvatarClick?: () => void;
}) => {
  const memberAvatars = useGroupMembersAvatars(convoId);
  const firstMemberId = memberAvatars?.firstMember || '';
  const secondMemberID = memberAvatars?.secondMember || '';

  const avatarSize = Math.floor((containerSize * 8) / 11);

  if (!avatarSize) {
    throw new Error(`Invalid avatar size ${containerSize}`);
  }

  const { bgColor } = useAvatarBgColor(secondMemberID || convoId);

  if (firstMemberId && secondMemberID) {
    return (
      <StyledAvatarClosedContainer containerSize={containerSize}>
        <Avatar size={avatarSize} pubkey={firstMemberId} onAvatarClick={onAvatarClick} />
        <Avatar size={avatarSize} pubkey={secondMemberID} onAvatarClick={onAvatarClick} />
      </StyledAvatarClosedContainer>
    );
  }

  return (
    <StyledAvatarClosedContainer containerSize={containerSize}>
      <Avatar
        size={avatarSize}
        pubkey={UserUtils.getOurPubKeyStrFromCache()}
        onAvatarClick={onAvatarClick}
      />
      <StyledAvatar $diameter={avatarSize} className={`module-avatar`}>
        <MemberAvatarPlaceHolder bgColor={bgColor} />
      </StyledAvatar>
    </StyledAvatarClosedContainer>
  );
};
