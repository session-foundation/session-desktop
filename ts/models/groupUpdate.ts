import type { TrArgs } from '../localization/localeTools';
import { ConvoHub } from '../session/conversations';
import { UserUtils } from '../session/utils';

function usAndXOthers(arr: Array<string>) {
  const us = UserUtils.getOurPubKeyStrFromCache();

  const others = arr.filter(m => m !== us).sort();

  if (others.length !== arr.length) {
    return { us: true, others };
  }
  return { us: false, others };
}

export function getKickedGroupUpdateStr(kicked: Array<string>, _groupName: string): TrArgs {
  const { others, us } = usAndXOthers(kicked);
  const othersNames = others.map(ConvoHub.use().getNicknameOrRealUsernameOrPlaceholder);

  if (us) {
    switch (others.length) {
      case 0:
        return { token: 'groupRemovedYouGeneral' };
      case 1:
        return { token: 'groupRemovedYouTwo', other_name: othersNames[0] };
      default:
        return { token: 'groupRemovedYouMultiple', count: othersNames.length };
    }
  }

  switch (othersNames.length) {
    case 0:
      return { token: 'groupUpdated' };
    case 1:
      return { token: 'groupRemoved', name: othersNames[0] };
    case 2:
      return {
        token: 'groupRemovedTwo',
        name: othersNames[0],
        other_name: othersNames[1],
      };
    default:
      return {
        token: 'groupRemovedMultiple',
        name: othersNames[0],
        count: othersNames.length - 1,
      };
  }
}

export function getLeftGroupUpdateChangeStr(left: Array<string>) {
  const { others, us } = usAndXOthers(left);

  if (left.length !== 1) {
    throw new Error('left.length should never be more than 1');
  }

  return us
    ? ({ token: 'groupMemberYouLeft' } as const)
    : ({
        token: 'groupMemberLeft',
        name: ConvoHub.use().getNicknameOrRealUsernameOrPlaceholder(others[0]),
      } as const);
}

export function getJoinedGroupUpdateChangeStr(
  joined: Array<string>,
  groupv2: boolean,
  addedWithHistory: boolean,
  _groupName: string
): TrArgs {
  const { others, us } = usAndXOthers(joined);
  const othersNames = others.map(ConvoHub.use().getNicknameOrRealUsernameOrPlaceholder);

  if (groupv2) {
    if (us) {
      switch (othersNames.length) {
        case 0:
          return {
            token: addedWithHistory ? 'groupInviteYouHistory' : 'groupInviteYou',
          };
        case 1:
          return addedWithHistory
            ? { token: 'groupMemberNewYouHistoryTwo', other_name: othersNames[0] }
            : { token: 'groupInviteYouAndOtherNew', other_name: othersNames[0] };
        default:
          return addedWithHistory
            ? { token: 'groupMemberNewYouHistoryMultiple', count: othersNames.length }
            : { token: 'groupInviteYouAndMoreNew', count: othersNames.length };
      }
    }
    switch (othersNames.length) {
      case 0:
        return { token: 'groupUpdated' }; // this is an invalid case, but well.
      case 1:
        return addedWithHistory
          ? { token: 'groupMemberNewHistory', name: othersNames[0] }
          : { token: 'groupMemberNew', name: othersNames[0] };
      case 2:
        return addedWithHistory
          ? {
              token: 'groupMemberNewHistoryTwo',
              name: othersNames[0],
              other_name: othersNames[1],
            }
          : {
              token: 'groupMemberNewTwo',
              name: othersNames[0],
              other_name: othersNames[1],
            };
      default:
        return addedWithHistory
          ? {
              token: 'groupMemberNewHistoryMultiple',
              name: othersNames[0],
              count: othersNames.length - 1,
            }
          : {
              token: 'groupMemberNewMultiple',
              name: othersNames[0],
              count: othersNames.length - 1,
            };
    }
  }

  // legacy groups
  if (us) {
    switch (othersNames.length) {
      case 0:
        return { token: 'legacyGroupMemberYouNew' };
      case 1:
        return { token: 'legacyGroupMemberNewYouOther', other_name: othersNames[0] };
      default:
        return { token: 'legacyGroupMemberNewYouMultiple', count: othersNames.length };
    }
  }
  switch (othersNames.length) {
    case 0:
      return { token: 'groupUpdated' };
    case 1:
      return { token: 'legacyGroupMemberNew', name: othersNames[0] };
    case 2:
      return {
        token: 'legacyGroupMemberTwoNew',
        name: othersNames[0],
        other_name: othersNames[1],
      };
    default:
      return {
        token: 'legacyGroupMemberNewMultiple',
        name: othersNames[0],
        count: othersNames.length - 1,
      };
  }
}

export function getPromotedGroupUpdateChangeStr(joined: Array<string>): TrArgs {
  const { others, us } = usAndXOthers(joined);
  const othersNames = others.map(ConvoHub.use().getNicknameOrRealUsernameOrPlaceholder);

  if (us) {
    switch (othersNames.length) {
      case 0:
        return { token: 'groupPromotedYou' };
      case 1:
        return { token: 'groupPromotedYouTwo', other_name: othersNames[0] };
      default:
        return { token: 'groupPromotedYouMultiple', count: othersNames.length };
    }
  }
  switch (othersNames.length) {
    case 0:
      return { token: 'groupUpdated' };
    case 1:
      return { token: 'adminPromotedToAdmin', name: othersNames[0] };
    case 2:
      return {
        token: 'adminTwoPromotedToAdmin',
        name: othersNames[0],
        other_name: othersNames[1],
      };
    default:
      return {
        token: 'adminMorePromotedToAdmin',
        name: othersNames[0],
        count: othersNames.length - 1,
      };
  }
}

export function getGroupNameChangeStr(newName: string | undefined): TrArgs {
  return newName ? { token: 'groupNameNew', group_name: newName } : { token: 'groupNameUpdated' };
}

export function getGroupDisplayPictureChangeStr(): TrArgs {
  return { token: 'groupDisplayPictureUpdated' };
}
