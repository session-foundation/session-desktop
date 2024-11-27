import {
  GroupMemberGet,
  GroupPubkeyType,
  MemberStateGroupV2,
  PubkeyType,
} from 'libsession_util_nodejs';
import { useSelector } from 'react-redux';
import { compact, concat, differenceBy, sortBy, uniqBy } from 'lodash';
import { PubKey } from '../../session/types';
import { GroupState } from '../ducks/metaGroups';
import { StateType } from '../reducer';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { UserUtils } from '../../session/utils';
import { useConversationsNicknameRealNameOrShortenPubkey } from '../../hooks/useParamSelector';

const getLibGroupsState = (state: StateType): GroupState => state.groups;
const getInviteSendingState = (state: StateType) => getLibGroupsState(state).membersInviteSending;
const getPromoteSendingState = (state: StateType) => getLibGroupsState(state).membersPromoteSending;

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

/**
 * The selectors above are all deriving data from libsession.
 * There is also some data that we only need in memory, not part of libsession (and so unsaved).
 * An example is the "sending invite" or "sending promote" state of a member in a group.
 */

function useMembersInviteSending(groupPk?: string) {
  return useSelector((state: StateType) =>
    groupPk && PubKey.is03Pubkey(groupPk) ? getInviteSendingState(state)[groupPk] || [] : []
  );
}

export function useMemberInviteSending(groupPk: GroupPubkeyType, memberPk: PubkeyType) {
  return useMembersInviteSending(groupPk).includes(memberPk);
}

function useMembersPromoteSending(groupPk?: string) {
  return useSelector((state: StateType) =>
    groupPk && PubKey.is03Pubkey(groupPk) ? getPromoteSendingState(state)[groupPk] || [] : []
  );
}

export function useMemberPromoteSending(groupPk: GroupPubkeyType, memberPk: PubkeyType) {
  return useMembersPromoteSending(groupPk).includes(memberPk);
}

type MemberStateGroupV2WithSending = MemberStateGroupV2 | 'INVITE_SENDING' | 'PROMOTION_SENDING';
type MemberWithV2Sending = Pick<GroupMemberGet, 'pubkeyHex'> & {
  memberStatus: MemberStateGroupV2WithSending;
};

export function useStateOf03GroupMembers(convoId?: string) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  let unsortedMembers = useSelector((state: StateType) => getMembersOfGroup(state, convoId));
  const invitesSendingPk = useMembersInviteSending(convoId);
  const promotionsSendingPk = useMembersPromoteSending(convoId);
  let invitesSending: Array<MemberWithV2Sending> = compact(
    invitesSendingPk
      .map(sending => unsortedMembers.find(m => m.pubkeyHex === sending))
      .map(m => {
        return m ? { ...m, memberStatus: 'INVITE_SENDING' as const } : null;
      })
  );
  const promotionSending: Array<MemberWithV2Sending> = compact(
    promotionsSendingPk
      .map(sending => unsortedMembers.find(m => m.pubkeyHex === sending))
      .map(m => {
        return m ? { ...m, memberStatus: 'PROMOTION_SENDING' as const } : null;
      })
  );

  // promotionSending has priority against invitesSending, so removing anything in invitesSending found in promotionSending
  invitesSending = differenceBy(invitesSending, promotionSending, value => value.pubkeyHex);

  const bothSending = concat(promotionSending, invitesSending);

  // promotionSending and invitesSending has priority against anything else, so remove anything found in one of those two
  // from the unsorted list of members
  unsortedMembers = differenceBy(unsortedMembers, bothSending, value => value.pubkeyHex);

  // at this point, merging invitesSending, promotionSending and unsortedMembers should create an array of unique members
  const sortedByPriorities = concat(bothSending, unsortedMembers);
  if (sortedByPriorities.length !== uniqBy(sortedByPriorities, m => m.pubkeyHex).length) {
    throw new Error(
      'merging invitesSending, promotionSending and unsortedMembers should create an array of unique members'
    );
  }

  // This could have been done now with a `sortedByPriorities.map()` call,
  // but we don't want the order as sorted by `sortedByPriorities`, **only** to respect the priorities from it.
  // What that means is that a member with a state as inviteSending, should have that state, but not be sorted first.

  // The order we (for now) want is:
  // - (Invite failed + Invite Not Sent) merged together, sorted as NameSortingOrder
  // - Sending invite, sorted as NameSortingOrder
  // - Invite sent, sorted as NameSortingOrder
  // - (Promotion failed + Promotion Not Sent) merged together, sorted as NameSortingOrder
  // - Sending invite, sorted as NameSortingOrder
  // - Invite sent, sorted as NameSortingOrder
  // - Admin, sorted as NameSortingOrder
  // - Accepted Member, sorted as NameSortingOrder
  // NameSortingOrder: You first, then "nickname || name || pubkey -> aA-zZ"

  const unsortedWithStatuses: Array<
    Pick<GroupMemberGet, 'pubkeyHex'> & { memberStatus: MemberStateGroupV2WithSending }
  > = [];
  unsortedWithStatuses.push(...promotionSending);
  unsortedWithStatuses.push(...differenceBy(invitesSending, promotionSending));
  unsortedWithStatuses.push(...differenceBy(unsortedMembers, invitesSending, promotionSending));
  const names = useConversationsNicknameRealNameOrShortenPubkey(
    unsortedWithStatuses.map(m => m.pubkeyHex)
  );

  // needing an index like this outside of lodash is not pretty,
  // but sortBy doesn't provide the index in the callback
  let index = 0;

  const sorted = sortBy(unsortedWithStatuses, item => {
    let stateSortingOrder = 0;
    switch (item.memberStatus) {
      case 'INVITE_FAILED':
      case 'INVITE_NOT_SENT':
        stateSortingOrder = -50;
        break;
      case 'INVITE_SENDING':
        stateSortingOrder = -40;
        break;
      case 'INVITE_SENT':
        stateSortingOrder = -30;
        break;
      case 'REMOVED_UNKNOWN': // fallback, hopefully won't happen in production
      case 'REMOVED_MEMBER': // we want pending removal members at the end
      case 'REMOVED_MEMBER_AND_MESSAGES':
        stateSortingOrder = -20;
        break;
      case 'PROMOTION_FAILED':
      case 'PROMOTION_NOT_SENT':
        stateSortingOrder = -15;
        break;
      case 'PROMOTION_SENDING':
        stateSortingOrder = -10;
        break;
      case 'PROMOTION_SENT':
        stateSortingOrder = 0;
        break;
      case 'PROMOTION_ACCEPTED':
        stateSortingOrder = 10;
        break;
      case 'INVITE_ACCEPTED':
        stateSortingOrder = 20;
        break;
      case 'INVITE_UNKNOWN': // fallback, hopefully won't happen in production
      case 'PROMOTION_UNKNOWN': // fallback, hopefully won't happen in production
        stateSortingOrder = 50;
        break;

      default:
        assertUnreachable(item.memberStatus, 'Unhandled switch case');
    }
    const sortingOrder = [
      stateSortingOrder,
      // per section, we want "us first", then "nickname || displayName || pubkey"
      item.pubkeyHex === us ? -1 : names[index]?.toLocaleLowerCase(),
    ];
    index++;
    return sortingOrder;
  });
  return sorted;
}
