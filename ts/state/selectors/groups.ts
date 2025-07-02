import { GroupPubkeyType, MemberStateGroupV2, PubkeyType } from 'libsession_util_nodejs';
import { useSelector } from 'react-redux';
import { sortBy } from 'lodash';
import { useMemo } from 'react';
import { createSelector } from '@reduxjs/toolkit';
import { PubKey } from '../../session/types';
import { GroupState } from '../ducks/metaGroups';
import { type GroupMemberGetRedux } from '../ducks/types/groupReduxTypes';
import { StateType } from '../reducer';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { UserUtils } from '../../session/utils';
import {
  useConversationsNicknameRealNameOrShortenPubkey,
  useWeAreAdmin,
} from '../../hooks/useParamSelector';

const selectLibGroupsState = (state: StateType): GroupState => state.groups;

const selectMembersOfGroup = createSelector(
  [(state: StateType) => state, (_state: StateType, convo?: string) => convo],
  (state: StateType, convo?: string) => {
    if (!convo) {
      return [];
    }
    if (!PubKey.is03Pubkey(convo)) {
      return [];
    }

    const members = selectLibGroupsState(state).members[convo];
    return members || [];
  }
);

function findMemberInMembers(members: Array<GroupMemberGetRedux>, memberPk: string) {
  return members.find(m => m.pubkeyHex === memberPk);
}

export function selectLibMembersPubkeys(state: StateType, convo?: string): Array<PubkeyType> {
  const members = selectMembersOfGroup(state, convo);

  return members.map(m => m.pubkeyHex);
}

function selectIsCreatingGroupFromUI(state: StateType): boolean {
  return selectLibGroupsState(state).creationFromUIPending;
}

function selectIsMemberGroupChangePendingFromUI(state: StateType): boolean {
  return selectLibGroupsState(state).memberChangesFromUIPending;
}

function selectGroupNameChangeFromUIPending(state: StateType): boolean {
  return selectLibGroupsState(state).nameChangesFromUIPending;
}

function selectGroupAvatarChangeFromUIPending(state: StateType): boolean {
  return selectLibGroupsState(state).avatarChangeFromUIPending;
}

export function selectLibAdminsPubkeys(state: StateType, convo?: string): Array<string> {
  const members = selectMembersOfGroup(state, convo);
  return members.filter(m => m.nominatedAdmin).map(m => m.pubkeyHex);
}

function selectMemberInviteFailed(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = selectMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'INVITE_FAILED' || false;
}

function selectMemberInviteNotSent(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = selectMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'INVITE_NOT_SENT' || false;
}

function selectMemberInviteSent(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = selectMembersOfGroup(state, convo);

  return findMemberInMembers(members, pubkey)?.memberStatus === 'INVITE_SENT' || false;
}

function selectMemberHasAcceptedPromotion(
  state: StateType,
  pubkey: PubkeyType,
  convo?: GroupPubkeyType
) {
  const members = selectMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'PROMOTION_ACCEPTED' || false;
}

function selectMemberIsNominatedAdmin(
  state: StateType,
  pubkey: PubkeyType,
  convo?: GroupPubkeyType
) {
  const members = selectMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.nominatedAdmin || false;
}

function selectMemberHasAcceptedInvite(
  state: StateType,
  pubkey: PubkeyType,
  convo?: GroupPubkeyType
) {
  const members = selectMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'INVITE_ACCEPTED' || false;
}

function selectMemberPromotionFailed(
  state: StateType,
  pubkey: PubkeyType,
  convo?: GroupPubkeyType
) {
  const members = selectMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'PROMOTION_FAILED' || false;
}

function selectMemberPromotionSent(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = selectMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'PROMOTION_SENT' || false;
}

function selectMemberPromotionNotSent(
  state: StateType,
  pubkey: PubkeyType,
  convo?: GroupPubkeyType
) {
  const members = selectMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'PROMOTION_NOT_SENT' || false;
}

function selectMemberPendingRemoval(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = selectMembersOfGroup(state, convo);
  const removedStatus = findMemberInMembers(members, pubkey)?.memberStatus;
  return (
    removedStatus === 'REMOVED_UNKNOWN' ||
    removedStatus === 'REMOVED_MEMBER' ||
    removedStatus === 'REMOVED_MEMBER_AND_MESSAGES'
  );
}

function selectMemberStatus(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = selectMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus;
}

export function selectLibMembersCount(state: StateType, convo?: GroupPubkeyType): Array<string> {
  return selectLibMembersPubkeys(state, convo);
}

function selectLibGroupName(state: StateType, convo?: string): string | undefined {
  if (!convo) {
    return undefined;
  }
  if (!PubKey.is03Pubkey(convo)) {
    return undefined;
  }

  const name = selectLibGroupsState(state).infos[convo]?.name;
  return name || undefined;
}

export function useLibGroupName(convoId?: string): string | undefined {
  return useSelector((state: StateType) => selectLibGroupName(state, convoId));
}

function selectLibGroupDescription(state: StateType, convo?: string): string {
  if (!convo || !PubKey.is03Pubkey(convo)) {
    return '';
  }

  const description = selectLibGroupsState(state).infos[convo]?.description;
  return description ?? '';
}

export function useLibGroupDescription(convoId?: string): string {
  return useSelector((state: StateType) => selectLibGroupDescription(state, convoId));
}

export function useLibGroupMembers(convoId?: string): Array<PubkeyType> {
  return useSelector((state: StateType) => selectLibMembersPubkeys(state, convoId));
}

export function useLibGroupAdmins(convoId?: string): Array<string> {
  return useSelector((state: StateType) => selectLibAdminsPubkeys(state, convoId));
}

export function selectLibGroupNameOutsideRedux(convoId: string): string | undefined {
  const state = window.inboxStore?.getState();
  return state ? selectLibGroupName(state, convoId) : undefined;
}

export function selectLibGroupMembersOutsideRedux(convoId: string): Array<string> {
  const state = window.inboxStore?.getState();
  return state ? selectLibMembersPubkeys(state, convoId) : [];
}

export function selectLibGroupAdminsOutsideRedux(convoId: string): Array<string> {
  const state = window.inboxStore?.getState();
  return state ? selectLibAdminsPubkeys(state, convoId) : [];
}

export function selectMemberInviteSentOutsideRedux(
  member: PubkeyType,
  convoId: GroupPubkeyType
): boolean {
  const state = window.inboxStore?.getState();
  return state ? selectMemberInviteSent(state, member, convoId) : false;
}

export function useIsCreatingGroupFromUIPending() {
  return useSelector(selectIsCreatingGroupFromUI);
}

export function useMemberStatus(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => selectMemberStatus(state, member, groupPk));
}

export function useMemberInviteFailed(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => selectMemberInviteFailed(state, member, groupPk));
}

export function useMemberInviteSent(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => selectMemberInviteSent(state, member, groupPk));
}

export function useMemberInviteNotSent(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => selectMemberInviteNotSent(state, member, groupPk));
}

export function useMemberHasAcceptedPromotion(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) =>
    selectMemberHasAcceptedPromotion(state, member, groupPk)
  );
}

export function useMemberIsNominatedAdmin(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => selectMemberIsNominatedAdmin(state, member, groupPk));
}

export function useMemberHasAcceptedInvite(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => selectMemberHasAcceptedInvite(state, member, groupPk));
}

export function useMemberPromotionFailed(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => selectMemberPromotionFailed(state, member, groupPk));
}

export function useMemberPromotionSent(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => selectMemberPromotionSent(state, member, groupPk));
}

export function useMemberPromotionNotSent(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => selectMemberPromotionNotSent(state, member, groupPk));
}

export function useMemberPendingRemoval(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => selectMemberPendingRemoval(state, member, groupPk));
}

export function useMemberGroupChangePending() {
  return useSelector(selectIsMemberGroupChangePendingFromUI);
}

export function useGroupNameChangeFromUIPending() {
  return useSelector(selectGroupNameChangeFromUIPending);
}

export function useGroupAvatarChangeFromUIPending() {
  return useSelector(selectGroupAvatarChangeFromUIPending);
}

function getSortingOrderForStatus(memberStatus: MemberStateGroupV2, weAreAdmin: boolean) {
  // Non-admins don't need to see the details as they cannot do anything to change their state.
  // so we only group members by You, Members,
  if (!weAreAdmin) {
    switch (memberStatus) {
      case 'PROMOTION_FAILED':
      case 'PROMOTION_NOT_SENT':
      case 'PROMOTION_SENDING':
      case 'PROMOTION_SENT':
      case 'PROMOTION_UNKNOWN':
      case 'PROMOTION_ACCEPTED':
        return 0;
      default:
        return 10;
    }
  }
  switch (memberStatus) {
    case 'INVITE_FAILED':
      return 0;
    case 'INVITE_NOT_SENT':
      return 10;
    case 'INVITE_SENDING':
      return 20;
    case 'INVITE_SENT':
      return 30;
    case 'INVITE_UNKNOWN': // fallback, hopefully won't happen in production
      return 40;
    case 'REMOVED_UNKNOWN': // fallback, hopefully won't happen in production
    case 'REMOVED_MEMBER': // we want pending removal members at the end of the "invite" states
    case 'REMOVED_MEMBER_AND_MESSAGES':
      return 50;
    case 'PROMOTION_FAILED':
      return 60;
    case 'PROMOTION_NOT_SENT':
      return 70;
    case 'PROMOTION_SENDING':
      return 80;
    case 'PROMOTION_SENT':
      return 90;
    case 'PROMOTION_UNKNOWN': // fallback, hopefully won't happen in production
      return 100;
    case 'PROMOTION_ACCEPTED':
      return 110;
    case 'INVITE_ACCEPTED':
      return 120;
    default:
      assertUnreachable(memberStatus, 'Unhandled switch case');
      return Number.MAX_SAFE_INTEGER;
  }
}

export function useStateOf03GroupMembers(convoId?: string) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  const unsortedMembers = useSelector((state: StateType) => selectMembersOfGroup(state, convoId));
  const weAreAdmin = useWeAreAdmin(convoId);

  const names = useConversationsNicknameRealNameOrShortenPubkey(
    unsortedMembers.map(m => m.pubkeyHex)
  );

  // Damn this sorting logic is overkill x2.
  // The sorting logic is as follows:
  //  - when **we are** an admin, we want to sort by the following order:
  //    - Each states of invite/promotion/etc separate, but You always at the top **per section**
  //  - when we **are not** an admin, we want to sort by the following order:
  //    - You (at the top, always)
  //    - Admins (without You as it is already at the top)
  //    - Others (same as above)
  const sorted = useMemo(() => {
    return sortBy(
      unsortedMembers,
      item => {
        // when we are not an admin, we want the current user (You) to be always be at the top
        if (!weAreAdmin && item.pubkeyHex === us) {
          return -1;
        }

        const sortingOrder = getSortingOrderForStatus(item.memberStatus, weAreAdmin);
        return sortingOrder;
      },
      item => {
        // when we are an admin, we want to sort "You" at the top per sections
        if (weAreAdmin && item.pubkeyHex === us) {
          return -1;
        }
        const index = unsortedMembers.findIndex(p => p.pubkeyHex === item.pubkeyHex);
        if (index < 0 || index >= names.length) {
          throw new Error('this should never happen');
        }

        return names[index].toLowerCase();
      }
    );
  }, [unsortedMembers, us, names, weAreAdmin]);

  return sorted;
}
