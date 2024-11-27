import { ConvoHub } from '../session/conversations';
import { UserUtils } from '../session/utils';
import type { LocalizerComponentPropsObject } from '../types/localizer';

// to remove after merge with groups
function usAndXOthers(arr: Array<string>) {
  const us = UserUtils.getOurPubKeyStrFromCache();

  if (arr.includes(us)) {
    return { us: true, others: arr.filter(m => m !== us) };
  }
  return { us: false, others: arr };
}

export function getKickedGroupUpdateStr(
  kicked: Array<string>,
  groupName: string
): LocalizerComponentPropsObject {
  const { others, us } = usAndXOthers(kicked);
  const othersNames = others.map(ConvoHub.use().getContactProfileNameOrShortenedPubKey);

  if (us) {
    switch (others.length) {
      case 0:
        return { token: 'groupRemovedYou', args: { group_name: groupName } };
      case 1:
        return { token: 'groupRemovedYouTwo', args: { other_name: othersNames[0] } };
      default:
        return { token: 'groupRemovedYouMultiple', args: { count: othersNames.length } };
    }
  }

  switch (othersNames.length) {
    case 0:
      return { token: 'groupUpdated' };
    case 1:
      return { token: 'groupRemoved', args: { name: othersNames[0] } };
    case 2:
      return {
        token: 'groupRemovedTwo',
        args: {
          name: othersNames[0],
          other_name: othersNames[1],
        },
      };
    default:
      return {
        token: 'groupRemovedMultiple',
        args: {
          name: othersNames[0],
          count: othersNames.length - 1,
        },
      };
  }
}

export function getLeftGroupUpdateChangeStr(left: Array<string>): LocalizerComponentPropsObject {
  const { others, us } = usAndXOthers(left);

  if (left.length !== 1) {
    throw new Error('left.length should never be more than 1');
  }

  return us
    ? { token: 'groupMemberYouLeft' }
    : {
        token: 'groupMemberLeft',
        args: {
          name: ConvoHub.use().getContactProfileNameOrShortenedPubKey(others[0]),
        },
      };
}

export function getJoinedGroupUpdateChangeStr(
  joined: Array<string>,
  groupv2: boolean,
  addedWithHistory: boolean,
  _groupName: string
): LocalizerComponentPropsObject {
  const { others, us } = usAndXOthers(joined);
  const othersNames = others.map(ConvoHub.use().getContactProfileNameOrShortenedPubKey);

  if (groupv2) {
    if (us) {
      switch (othersNames.length) {
        case 0:
          return { token: addedWithHistory ? 'groupInviteYouHistory' : 'groupInviteYou' };
        case 1:
          return addedWithHistory
            ? { token: 'groupMemberNewYouHistoryTwo', args: { name: othersNames[0] } }
            : { token: 'groupInviteYouAndOtherNew', args: { other_name: othersNames[0] } };
        default:
          return addedWithHistory
            ? { token: 'groupMemberNewYouHistoryMultiple', args: { count: othersNames.length } }
            : { token: 'groupInviteYouAndMoreNew', args: { count: othersNames.length } };
      }
    }
    switch (othersNames.length) {
      case 0:
        return { token: 'groupUpdated' }; // this is an invalid case, but well.
      case 1:
        return addedWithHistory
          ? { token: 'groupMemberNewHistory', args: { name: othersNames[0] } }
          : { token: 'groupMemberNew', args: { name: othersNames[0] } };
      case 2:
        return addedWithHistory
          ? {
              token: 'groupMemberNewHistoryTwo',
              args: { name: othersNames[0], other_name: othersNames[1] },
            }
          : {
              token: 'groupMemberNewTwo',
              args: { name: othersNames[0], other_name: othersNames[1] },
            };
      default:
        return addedWithHistory
          ? {
              token: 'groupMemberNewHistoryMultiple',
              args: { name: othersNames[0], count: othersNames.length - 1 },
            }
          : {
              token: 'groupMemberNewMultiple',
              args: { name: othersNames[0], count: othersNames.length - 1 },
            };
    }
  }

  // legacy groups
  if (us) {
    switch (othersNames.length) {
      case 0:
        return { token: 'legacyGroupMemberYouNew' };
      case 1:
        return { token: 'legacyGroupMemberNewYouOther', args: { other_name: othersNames[0] } };
      default:
        return { token: 'legacyGroupMemberNewYouMultiple', args: { count: othersNames.length } };
    }
  }
  switch (othersNames.length) {
    case 0:
      return { token: 'groupUpdated' };
    case 1:
      return { token: 'legacyGroupMemberNew', args: { name: othersNames[0] } };
    case 2:
      return {
        token: 'legacyGroupMemberTwoNew',
        args: {
          name: othersNames[0],
          other_name: othersNames[1],
        },
      };
    default:
      return {
        token: 'legacyGroupMemberNewMultiple',
        args: {
          name: othersNames[0],
          count: othersNames.length - 1,
        },
      };
  }
}

export function getPromotedGroupUpdateChangeStr(
  joined: Array<string>
): LocalizerComponentPropsObject {
  const { others, us } = usAndXOthers(joined);
  const othersNames = others.map(ConvoHub.use().getContactProfileNameOrShortenedPubKey);

  if (us) {
    switch (othersNames.length) {
      case 0:
        return { token: 'groupPromotedYou' };
      case 1:
        return { token: 'groupPromotedYouTwo', args: { name: othersNames[0] } };
      default:
        return { token: 'groupPromotedYouMultiple', args: { count: othersNames.length } };
    }
  }
  switch (othersNames.length) {
    case 0:
      return { token: 'groupUpdated' };
    case 1:
      return { token: 'adminPromotedToAdmin', args: { name: othersNames[0] } };
    case 2:
      return {
        token: 'adminTwoPromotedToAdmin',
        args: {
          name: othersNames[0],
          other_name: othersNames[1],
        },
      };
    default:
      return {
        token: 'adminMorePromotedToAdmin',
        args: {
          name: othersNames[0],
          count: othersNames.length - 1,
        },
      };
  }
}

export function getGroupNameChangeStr(newName: string | undefined): LocalizerComponentPropsObject {
  return newName
    ? { token: 'groupNameNew', args: { group_name: newName } }
    : { token: 'groupNameUpdated' };
}

export function getGroupDisplayPictureChangeStr(): LocalizerComponentPropsObject {
  return { token: 'groupDisplayPictureUpdated' };
}
