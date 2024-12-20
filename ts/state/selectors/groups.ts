import {
  GroupMemberGet,
  GroupPubkeyType,
  MemberStateGroupV2,
  PubkeyType,
} from 'libsession_util_nodejs';
import { useSelector } from 'react-redux';
import { sortBy } from 'lodash';
import { useMemo } from 'react';
import { PubKey } from '../../session/types';
import { GroupState } from '../ducks/metaGroups';
import { StateType } from '../reducer';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { UserUtils } from '../../session/utils';
import { useConversationsNicknameRealNameOrShortenPubkey } from '../../hooks/useParamSelector';

const getLibGroupsState = (state: StateType): GroupState => state.groups;

function getMembersOfGroup(state: StateType, convo?: string): Array<GroupMemberGet> {
  if (!convo) {
    return [];
  }
  if (!PubKey.is03Pubkey(convo)) {
    return [];
  }

  const members = getLibGroupsState(state).members[convo];
  return members || [];
}

function findMemberInMembers(members: Array<GroupMemberGet>, memberPk: string) {
  return members.find(m => m.pubkeyHex === memberPk);
}

export function getLibMembersPubkeys(state: StateType, convo?: string): Array<PubkeyType> {
  const members = getMembersOfGroup(state, convo);

  return members.map(m => m.pubkeyHex);
}

function getIsCreatingGroupFromUI(state: StateType): boolean {
  return getLibGroupsState(state).creationFromUIPending;
}

function getIsMemberGroupChangePendingFromUI(state: StateType): boolean {
  return getLibGroupsState(state).memberChangesFromUIPending;
}

function getGroupNameChangeFromUIPending(state: StateType): boolean {
  return getLibGroupsState(state).nameChangesFromUIPending;
}

export function getLibAdminsPubkeys(state: StateType, convo?: string): Array<string> {
  const members = getMembersOfGroup(state, convo);
  return members.filter(m => m.nominatedAdmin).map(m => m.pubkeyHex);
}

function getMemberInviteFailed(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = getMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'INVITE_FAILED' || false;
}

function getMemberInviteNotSent(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = getMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'INVITE_NOT_SENT' || false;
}

function getMemberInviteSent(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = getMembersOfGroup(state, convo);

  return findMemberInMembers(members, pubkey)?.memberStatus === 'INVITE_SENT' || false;
}

function getMemberHasAcceptedPromotion(
  state: StateType,
  pubkey: PubkeyType,
  convo?: GroupPubkeyType
) {
  const members = getMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'PROMOTION_ACCEPTED' || false;
}

function getMemberIsNominatedAdmin(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = getMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.nominatedAdmin || false;
}

function getMemberHasAcceptedInvite(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = getMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'INVITE_ACCEPTED' || false;
}

function getMemberPromotionFailed(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = getMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'PROMOTION_FAILED' || false;
}

function getMemberPromotionSent(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = getMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'PROMOTION_SENT' || false;
}

function getMemberPromotionNotSent(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = getMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus === 'PROMOTION_NOT_SENT' || false;
}

function getMemberPendingRemoval(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = getMembersOfGroup(state, convo);
  const removedStatus = findMemberInMembers(members, pubkey)?.memberStatus;
  return (
    removedStatus === 'REMOVED_UNKNOWN' ||
    removedStatus === 'REMOVED_MEMBER' ||
    removedStatus === 'REMOVED_MEMBER_AND_MESSAGES'
  );
}

function getMemberStatus(state: StateType, pubkey: PubkeyType, convo?: GroupPubkeyType) {
  const members = getMembersOfGroup(state, convo);
  return findMemberInMembers(members, pubkey)?.memberStatus;
}

export function getLibMembersCount(state: StateType, convo?: GroupPubkeyType): Array<string> {
  return getLibMembersPubkeys(state, convo);
}

function getLibGroupName(state: StateType, convo?: string): string | undefined {
  if (!convo) {
    return undefined;
  }
  if (!PubKey.is03Pubkey(convo)) {
    return undefined;
  }

  const name = getLibGroupsState(state).infos[convo]?.name;
  return name || undefined;
}

export function useLibGroupName(convoId?: string): string | undefined {
  return useSelector((state: StateType) => getLibGroupName(state, convoId));
}

export function useLibGroupMembers(convoId?: string): Array<PubkeyType> {
  return useSelector((state: StateType) => getLibMembersPubkeys(state, convoId));
}

export function useLibGroupAdmins(convoId?: string): Array<string> {
  return useSelector((state: StateType) => getLibAdminsPubkeys(state, convoId));
}

export function getLibGroupNameOutsideRedux(convoId: string): string | undefined {
  const state = window.inboxStore?.getState();
  return state ? getLibGroupName(state, convoId) : undefined;
}

export function getLibGroupMembersOutsideRedux(convoId: string): Array<string> {
  const state = window.inboxStore?.getState();
  return state ? getLibMembersPubkeys(state, convoId) : [];
}

export function getLibGroupAdminsOutsideRedux(convoId: string): Array<string> {
  const state = window.inboxStore?.getState();
  return state ? getLibAdminsPubkeys(state, convoId) : [];
}

export function getMemberInviteSentOutsideRedux(
  member: PubkeyType,
  convoId: GroupPubkeyType
): boolean {
  const state = window.inboxStore?.getState();
  return state ? getMemberInviteSent(state, member, convoId) : false;
}

export function useIsCreatingGroupFromUIPending() {
  return useSelector(getIsCreatingGroupFromUI);
}

export function useMemberStatus(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => getMemberStatus(state, member, groupPk));
}

export function useMemberInviteFailed(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => getMemberInviteFailed(state, member, groupPk));
}

export function useMemberInviteSent(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => getMemberInviteSent(state, member, groupPk));
}

export function useMemberInviteNotSent(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => getMemberInviteNotSent(state, member, groupPk));
}

export function useMemberHasAcceptedPromotion(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => getMemberHasAcceptedPromotion(state, member, groupPk));
}

export function useMemberIsNominatedAdmin(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => getMemberIsNominatedAdmin(state, member, groupPk));
}

export function useMemberHasAcceptedInvite(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => getMemberHasAcceptedInvite(state, member, groupPk));
}

export function useMemberPromotionFailed(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => getMemberPromotionFailed(state, member, groupPk));
}

export function useMemberPromotionSent(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => getMemberPromotionSent(state, member, groupPk));
}

export function useMemberPromotionNotSent(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => getMemberPromotionNotSent(state, member, groupPk));
}

export function useMemberPendingRemoval(member: PubkeyType, groupPk: GroupPubkeyType) {
  return useSelector((state: StateType) => getMemberPendingRemoval(state, member, groupPk));
}

export function useMemberGroupChangePending() {
  return useSelector(getIsMemberGroupChangePendingFromUI);
}

export function useGroupNameChangeFromUIPending() {
  return useSelector(getGroupNameChangeFromUIPending);
}

function getSortingOrderForStatus(memberStatus: MemberStateGroupV2) {
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
  const unsortedMembers = useSelector((state: StateType) => getMembersOfGroup(state, convoId));

  const names = useConversationsNicknameRealNameOrShortenPubkey(
    unsortedMembers.map(m => m.pubkeyHex)
  );

  const sorted = useMemo(() => {
    // needing an index like this outside of lodash is not pretty,
    // but sortBy doesn't provide the index in the callback
    let index = 0;
    return sortBy(unsortedMembers, item => {
      const stateSortingOrder = getSortingOrderForStatus(item.memberStatus);
      const sortingOrder = [
        stateSortingOrder,
        // per section, we want "us"  first, then "nickname || displayName || pubkey"
        item.pubkeyHex === us ? -1 : names[index],
      ];
      index++;
      return sortingOrder;
    });
  }, [unsortedMembers, us, names]);
  return sorted;
}
