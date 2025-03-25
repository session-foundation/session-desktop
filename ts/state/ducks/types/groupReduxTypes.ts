import type { UserGroupsGet, GroupMemberGet } from 'libsession_util_nodejs';
import { pick } from 'lodash';
import { toHex } from '../../../session/utils/String';

export type UserGroupsRedux = Pick<
  UserGroupsGet,
  | 'priority'
  | 'pubkeyHex'
  | 'kicked'
  | 'name'
  | 'joinedAtSeconds'
  | 'invitePending'
  | 'disappearingTimerSeconds'
  | 'destroyed'
> & { secretKeyHex: string | null; authDataHex: string | null };

export type GroupMemberGetRedux = Pick<
  GroupMemberGet,
  'memberStatus' | 'name' | 'nominatedAdmin' | 'pubkeyHex' | 'supplement'
>;

export function makeGroupMemberGetRedux(memberGet: GroupMemberGet): GroupMemberGetRedux {
  return pick(memberGet, ['memberStatus', 'name', 'nominatedAdmin', 'pubkeyHex', 'supplement']);
}

export function makeUserGroupGetRedux(m: UserGroupsGet) {
  return {
    authDataHex: m.authData ? toHex(m.authData) : null,
    secretKeyHex: m.secretKey ? toHex(m.secretKey) : null,
    ...pick(m, [
      'priority',
      'pubkeyHex',
      'kicked',
      'name',
      'joinedAtSeconds',
      'invitePending',
      'disappearingTimerSeconds',
      'destroyed',
    ]),
  };
}
