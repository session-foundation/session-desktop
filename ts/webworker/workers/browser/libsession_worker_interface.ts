/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import {
  BlindingActionsCalls,
  ContactInfoSet,
  ContactsWrapperActionsCalls,
  ConvoInfoVolatileWrapperActionsCalls,
  GenericWrapperActionsCall as UserGenericWrapperActionsCall,
  GroupInfoSet,
  GroupPubkeyType,
  GroupWrapperConstructor,
  LegacyGroupInfo,
  MergeSingle,
  MetaGroupWrapperActionsCalls,
  MultiEncryptActionsCalls,
  ProfilePicture,
  PubkeyType,
  Uint8ArrayLen100,
  Uint8ArrayLen64,
  UserConfigWrapperActionsCalls,
  UserGroupsGet,
  UserGroupsSet,
  UserGroupsWrapperActionsCalls,
  EncryptionDomain,
  type ConfirmPush,
  type UtilitiesWrapperActionsCalls,
} from 'libsession_util_nodejs';
// eslint-disable-next-line import/order
import { join } from 'path';

import { getAppRootPath } from '../../../node/getRootPath';
import { userGroupsActions } from '../../../state/ducks/userGroups';
import { WorkerInterface } from '../../worker_interface';
import { ConfigWrapperUser, LibSessionWorkerFunctions } from './libsession_worker_functions';
import { makeUserGroupGetRedux } from '../../../state/ducks/types/groupReduxTypes';

let libsessionWorkerInterface: WorkerInterface | undefined;

const internalCallLibSessionWorker = async ([
  config,
  fnName,
  ...args
]: LibSessionWorkerFunctions): Promise<unknown> => {
  if (!libsessionWorkerInterface) {
    const libsessionWorkerPath = join(
      getAppRootPath(),
      'ts',
      'webworker',
      'workers',
      'node',
      'libsession',
      'libsession.worker.compiled.js'
    );

    libsessionWorkerInterface = new WorkerInterface(libsessionWorkerPath, 1 * 60 * 1000);
  }
  const result = libsessionWorkerInterface?.callWorker(config, fnName, ...args);

  return result;
};

type UserGenericWrapperActionsCalls = {
  init: (
    wrapperId: ConfigWrapperUser,
    ed25519Key: Uint8Array,
    dump: Uint8Array | null
  ) => Promise<void>;
  free: (wrapperId: ConfigWrapperUser) => Promise<void>;
  confirmPushed: UserGenericWrapperActionsCall<ConfigWrapperUser, 'confirmPushed'>;
  dump: UserGenericWrapperActionsCall<ConfigWrapperUser, 'dump'>;
  makeDump: UserGenericWrapperActionsCall<ConfigWrapperUser, 'makeDump'>;
  merge: UserGenericWrapperActionsCall<ConfigWrapperUser, 'merge'>;
  needsDump: UserGenericWrapperActionsCall<ConfigWrapperUser, 'needsDump'>;
  needsPush: UserGenericWrapperActionsCall<ConfigWrapperUser, 'needsPush'>;
  push: UserGenericWrapperActionsCall<ConfigWrapperUser, 'push'>;
  activeHashes: UserGenericWrapperActionsCall<ConfigWrapperUser, 'activeHashes'>;
  storageNamespace: UserGenericWrapperActionsCall<ConfigWrapperUser, 'storageNamespace'>;
};

export const UserGenericWrapperActions: UserGenericWrapperActionsCalls = {
  /** base wrapper generic actions */

  init: async (wrapperId: ConfigWrapperUser, ed25519Key: Uint8Array, dump: Uint8Array | null) =>
    callLibSessionWorker([wrapperId, 'init', ed25519Key, dump]) as ReturnType<
      UserGenericWrapperActionsCalls['init']
    >,

  /** This function is used to free wrappers from memory only.
   *
   * See freeUserWrapper() in libsession.worker.ts */
  free: async (wrapperId: ConfigWrapperUser) =>
    callLibSessionWorker([wrapperId, 'free']) as Promise<void>,
  confirmPushed: async (wrapperId: ConfigWrapperUser, pushed: ConfirmPush) =>
    callLibSessionWorker([wrapperId, 'confirmPushed', pushed]) as ReturnType<
      UserGenericWrapperActionsCalls['confirmPushed']
    >,
  dump: async (wrapperId: ConfigWrapperUser) =>
    callLibSessionWorker([wrapperId, 'dump']) as ReturnType<UserGenericWrapperActionsCalls['dump']>,
  makeDump: async (wrapperId: ConfigWrapperUser) =>
    callLibSessionWorker([wrapperId, 'makeDump']) as ReturnType<
      UserGenericWrapperActionsCalls['makeDump']
    >,
  merge: async (wrapperId: ConfigWrapperUser, toMerge: Array<MergeSingle>) =>
    callLibSessionWorker([wrapperId, 'merge', toMerge]) as ReturnType<
      UserGenericWrapperActionsCalls['merge']
    >,
  needsDump: async (wrapperId: ConfigWrapperUser) =>
    callLibSessionWorker([wrapperId, 'needsDump']) as ReturnType<
      UserGenericWrapperActionsCalls['needsDump']
    >,
  needsPush: async (wrapperId: ConfigWrapperUser) =>
    callLibSessionWorker([wrapperId, 'needsPush']) as ReturnType<
      UserGenericWrapperActionsCalls['needsPush']
    >,
  push: async (wrapperId: ConfigWrapperUser) =>
    callLibSessionWorker([wrapperId, 'push']) as ReturnType<UserGenericWrapperActionsCalls['push']>,
  activeHashes: async (wrapperId: ConfigWrapperUser) =>
    callLibSessionWorker([wrapperId, 'activeHashes']) as ReturnType<
      UserGenericWrapperActionsCalls['activeHashes']
    >,
  storageNamespace: async (wrapperId: ConfigWrapperUser) =>
    callLibSessionWorker([wrapperId, 'storageNamespace']) as ReturnType<
      UserGenericWrapperActionsCalls['storageNamespace']
    >,
};

function createBaseActionsFor(wrapperType: ConfigWrapperUser) {
  return {
    /* Reuse the UserConfigWrapperActions with the UserConfig argument */
    init: async (ed25519Key: Uint8Array, dump: Uint8Array | null) =>
      UserGenericWrapperActions.init(wrapperType, ed25519Key, dump),
    free: async () => UserGenericWrapperActions.free(wrapperType),
    confirmPushed: async (pushed: ConfirmPush) =>
      UserGenericWrapperActions.confirmPushed(wrapperType, pushed),
    dump: async () => UserGenericWrapperActions.dump(wrapperType),
    makeDump: async () => UserGenericWrapperActions.makeDump(wrapperType),
    needsDump: async () => UserGenericWrapperActions.needsDump(wrapperType),
    needsPush: async () => UserGenericWrapperActions.needsPush(wrapperType),
    push: async () => UserGenericWrapperActions.push(wrapperType),
    activeHashes: async () => UserGenericWrapperActions.activeHashes(wrapperType),
    merge: async (toMerge: Array<MergeSingle>) =>
      UserGenericWrapperActions.merge(wrapperType, toMerge),
    storageNamespace: async () => UserGenericWrapperActions.storageNamespace(wrapperType),
  };
}

export const UserConfigWrapperActions: UserConfigWrapperActionsCalls = {
  /* Reuse the UserConfigWrapperActions with the UserConfig argument */
  ...createBaseActionsFor('UserConfig'),

  /** UserConfig wrapper specific actions */
  getPriority: async () =>
    callLibSessionWorker(['UserConfig', 'getPriority']) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getPriority']>
    >,
  getName: async () =>
    callLibSessionWorker(['UserConfig', 'getName']) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getName']>
    >,
  getProfilePic: async () =>
    callLibSessionWorker(['UserConfig', 'getProfilePic']) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getProfilePic']>
    >,
  setPriority: async (priority: number) =>
    callLibSessionWorker(['UserConfig', 'setPriority', priority]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['setPriority']>
    >,
  setName: async (name: string) =>
    callLibSessionWorker(['UserConfig', 'setName', name]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['setName']>
    >,
  setNameTruncated: async (name: string) =>
    callLibSessionWorker(['UserConfig', 'setNameTruncated', name]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['setNameTruncated']>
    >,
  setProfilePic: async (profilePic: ProfilePicture) =>
    callLibSessionWorker(['UserConfig', 'setProfilePic', profilePic]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['setProfilePic']>
    >,
  getEnableBlindedMsgRequest: async () =>
    callLibSessionWorker(['UserConfig', 'getEnableBlindedMsgRequest']) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getEnableBlindedMsgRequest']>
    >,
  setEnableBlindedMsgRequest: async (blindedMsgRequests: boolean) =>
    callLibSessionWorker([
      'UserConfig',
      'setEnableBlindedMsgRequest',
      blindedMsgRequests,
    ]) as Promise<ReturnType<UserConfigWrapperActionsCalls['setEnableBlindedMsgRequest']>>,
  getNoteToSelfExpiry: async () =>
    callLibSessionWorker(['UserConfig', 'getNoteToSelfExpiry']) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getNoteToSelfExpiry']>
    >,
  setNoteToSelfExpiry: async (expirySeconds: number) =>
    callLibSessionWorker(['UserConfig', 'setNoteToSelfExpiry', expirySeconds]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['setNoteToSelfExpiry']>
    >,
};

export const ContactsWrapperActions: ContactsWrapperActionsCalls = {
  /* Reuse the UserConfigWrapperActions with the ContactConfig argument */
  ...createBaseActionsFor('ContactsConfig'),

  /** ContactsConfig wrapper specific actions */
  get: async (pubkeyHex: string) =>
    callLibSessionWorker(['ContactsConfig', 'get', pubkeyHex]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['get']>
    >,
  getAll: async () =>
    callLibSessionWorker(['ContactsConfig', 'getAll']) as Promise<
      ReturnType<ContactsWrapperActionsCalls['getAll']>
    >,

  erase: async (pubkeyHex: string) =>
    callLibSessionWorker(['ContactsConfig', 'erase', pubkeyHex]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['erase']>
    >,

  set: async (contact: ContactInfoSet) =>
    callLibSessionWorker(['ContactsConfig', 'set', contact]) as Promise<
      ReturnType<ContactsWrapperActionsCalls['set']>
    >,
};

// this is a cache of the new groups only. Anytime we create, update, delete, or merge a group, we update this
const groups: Map<GroupPubkeyType, UserGroupsGet> = new Map();

function dispatchCachedGroupsToRedux() {
  window?.inboxStore?.dispatch?.(
    userGroupsActions.refreshUserGroupsSlice({
      groups: [...groups.values()].map(makeUserGroupGetRedux),
    })
  );
}

function dispatchCachedGroupToRedux(groupId: GroupPubkeyType) {
  const groupFound = groups.get(groupId);
  if (groupFound) {
    window?.inboxStore?.dispatch?.(
      userGroupsActions.refreshUserGroupDetails({
        group: makeUserGroupGetRedux(groupFound),
      })
    );
  } else {
    window?.inboxStore?.dispatch?.(
      userGroupsActions.deleteUserGroupDetails({
        group: {
          pubkey: groupId,
        },
      })
    );
  }
}

export const UserGroupsWrapperActions: UserGroupsWrapperActionsCalls & {
  getCachedGroup: (pubkeyHex: GroupPubkeyType) => UserGroupsGet | undefined;
} = {
  /* Reuse the UserConfigWrapperActions with the UserGroupsConfig argument */
  ...createBaseActionsFor('UserGroupsConfig'),
  // override the merge() as we need to refresh the cached groups
  merge: async (toMerge: Array<MergeSingle>) => {
    const mergeRet = await UserGenericWrapperActions.merge('UserGroupsConfig', toMerge);
    await UserGroupsWrapperActions.getAllGroups(); // this refreshes the cached data after merge
    return mergeRet;
  },

  /** UserGroups wrapper specific actions */

  getCommunityByFullUrl: async (fullUrlWithOrWithoutPubkey: string) =>
    callLibSessionWorker([
      'UserGroupsConfig',
      'getCommunityByFullUrl',
      fullUrlWithOrWithoutPubkey,
    ]) as Promise<ReturnType<UserGroupsWrapperActionsCalls['getCommunityByFullUrl']>>,

  setCommunityByFullUrl: async (fullUrl: string, priority: number) =>
    callLibSessionWorker([
      'UserGroupsConfig',
      'setCommunityByFullUrl',
      fullUrl,
      priority,
    ]) as Promise<ReturnType<UserGroupsWrapperActionsCalls['setCommunityByFullUrl']>>,

  getAllCommunities: async () =>
    callLibSessionWorker(['UserGroupsConfig', 'getAllCommunities']) as Promise<
      ReturnType<UserGroupsWrapperActionsCalls['getAllCommunities']>
    >,

  eraseCommunityByFullUrl: async (fullUrlWithoutPubkey: string) =>
    callLibSessionWorker([
      'UserGroupsConfig',
      'eraseCommunityByFullUrl',
      fullUrlWithoutPubkey,
    ]) as Promise<ReturnType<UserGroupsWrapperActionsCalls['eraseCommunityByFullUrl']>>,

  buildFullUrlFromDetails: async (baseUrl: string, roomId: string, pubkeyHex: string) =>
    callLibSessionWorker([
      'UserGroupsConfig',
      'buildFullUrlFromDetails',
      baseUrl,
      roomId,
      pubkeyHex,
    ]) as Promise<ReturnType<UserGroupsWrapperActionsCalls['buildFullUrlFromDetails']>>,

  getLegacyGroup: async (pubkeyHex: string) =>
    callLibSessionWorker(['UserGroupsConfig', 'getLegacyGroup', pubkeyHex]) as Promise<
      ReturnType<UserGroupsWrapperActionsCalls['getLegacyGroup']>
    >,
  getAllLegacyGroups: async () =>
    callLibSessionWorker(['UserGroupsConfig', 'getAllLegacyGroups']) as Promise<
      ReturnType<UserGroupsWrapperActionsCalls['getAllLegacyGroups']>
    >,

  setLegacyGroup: async (info: LegacyGroupInfo) =>
    callLibSessionWorker(['UserGroupsConfig', 'setLegacyGroup', info]) as Promise<
      ReturnType<UserGroupsWrapperActionsCalls['setLegacyGroup']>
    >,

  eraseLegacyGroup: async (pubkeyHex: string) =>
    callLibSessionWorker(['UserGroupsConfig', 'eraseLegacyGroup', pubkeyHex]) as Promise<
      ReturnType<UserGroupsWrapperActionsCalls['eraseLegacyGroup']>
    >,

  createGroup: async () => {
    const group = (await callLibSessionWorker(['UserGroupsConfig', 'createGroup'])) as Awaited<
      ReturnType<UserGroupsWrapperActionsCalls['createGroup']>
    >;
    groups.set(group.pubkeyHex, group);
    dispatchCachedGroupToRedux(group.pubkeyHex);

    return group;
  },

  getGroup: async (pubkeyHex: GroupPubkeyType) => {
    const group = (await callLibSessionWorker([
      'UserGroupsConfig',
      'getGroup',
      pubkeyHex,
    ])) as Awaited<ReturnType<UserGroupsWrapperActionsCalls['getGroup']>>;
    if (group) {
      groups.set(group.pubkeyHex, group);
    } else {
      groups.delete(pubkeyHex);
    }
    // Note: for performance reasons, we don't want to trigger a UI refresh here.
    // a getGroup can be done in many places, but we only ever need to refresh the UI on sets/merge
    // Dispatching a UI changes causes the performance on large DB to be poor.

    return group;
  },

  getCachedGroup: (pubkeyHex: GroupPubkeyType) => {
    return groups.get(pubkeyHex);
  },

  getAllGroups: async () => {
    const groupsFetched = (await callLibSessionWorker([
      'UserGroupsConfig',
      'getAllGroups',
    ])) as Awaited<ReturnType<UserGroupsWrapperActionsCalls['getAllGroups']>>;
    groups.clear();
    groupsFetched.forEach(f => groups.set(f.pubkeyHex, f));
    dispatchCachedGroupsToRedux();
    return groupsFetched;
  },

  setGroup: async (info: UserGroupsSet) => {
    const group = (await callLibSessionWorker(['UserGroupsConfig', 'setGroup', info])) as Awaited<
      ReturnType<UserGroupsWrapperActionsCalls['setGroup']>
    >;
    groups.set(group.pubkeyHex, group);

    dispatchCachedGroupToRedux(group.pubkeyHex);

    return group;
  },

  markGroupKicked: async (pubkeyHex: GroupPubkeyType) => {
    const group = (await callLibSessionWorker([
      'UserGroupsConfig',
      'markGroupKicked',
      pubkeyHex,
    ])) as Awaited<ReturnType<UserGroupsWrapperActionsCalls['markGroupKicked']>>;
    groups.set(group.pubkeyHex, group);
    dispatchCachedGroupToRedux(group.pubkeyHex);

    return group;
  },

  markGroupInvited: async (pubkeyHex: GroupPubkeyType) => {
    const group = (await callLibSessionWorker([
      'UserGroupsConfig',
      'markGroupInvited',
      pubkeyHex,
    ])) as Awaited<ReturnType<UserGroupsWrapperActionsCalls['markGroupInvited']>>;
    groups.set(group.pubkeyHex, group);

    dispatchCachedGroupToRedux(group.pubkeyHex);

    return group;
  },

  markGroupDestroyed: async (pubkeyHex: GroupPubkeyType) => {
    const group = (await callLibSessionWorker([
      'UserGroupsConfig',
      'markGroupDestroyed',
      pubkeyHex,
    ])) as Awaited<ReturnType<UserGroupsWrapperActionsCalls['markGroupDestroyed']>>;
    groups.set(group.pubkeyHex, group);

    dispatchCachedGroupToRedux(group.pubkeyHex);

    return group;
  },

  eraseGroup: async (pubkeyHex: GroupPubkeyType) => {
    const ret = (await callLibSessionWorker([
      'UserGroupsConfig',
      'eraseGroup',
      pubkeyHex,
    ])) as Awaited<ReturnType<UserGroupsWrapperActionsCalls['eraseGroup']>>;

    groups.delete(pubkeyHex);
    dispatchCachedGroupToRedux(pubkeyHex);

    return ret;
  },
};

export const ConvoInfoVolatileWrapperActions: ConvoInfoVolatileWrapperActionsCalls = {
  /* Reuse the UserConfigWrapperActions with the ConvoInfoVolatileConfig argument */
  ...createBaseActionsFor('ConvoInfoVolatileConfig'),

  /** ConvoInfoVolatile wrapper specific actions */
  // 1o1
  get1o1: async (pubkeyHex: string) =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'get1o1', pubkeyHex]) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['get1o1']>
    >,

  getAll1o1: async () =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'getAll1o1']) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['getAll1o1']>
    >,

  set1o1: async (pubkeyHex: string, lastRead: number, unread: boolean) =>
    callLibSessionWorker([
      'ConvoInfoVolatileConfig',
      'set1o1',
      pubkeyHex,
      lastRead,
      unread,
    ]) as Promise<ReturnType<ConvoInfoVolatileWrapperActionsCalls['set1o1']>>,

  erase1o1: async (pubkeyHex: string) =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'erase1o1', pubkeyHex]) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['erase1o1']>
    >,

  // legacy groups
  getLegacyGroup: async (pubkeyHex: string) =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'getLegacyGroup', pubkeyHex]) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['getLegacyGroup']>
    >,

  getAllLegacyGroups: async () =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'getAllLegacyGroups']) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['getAllLegacyGroups']>
    >,

  setLegacyGroup: async (pubkeyHex: string, lastRead: number, unread: boolean) =>
    callLibSessionWorker([
      'ConvoInfoVolatileConfig',
      'setLegacyGroup',
      pubkeyHex,
      lastRead,
      unread,
    ]) as Promise<ReturnType<ConvoInfoVolatileWrapperActionsCalls['setLegacyGroup']>>,

  eraseLegacyGroup: async (pubkeyHex: string) =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'eraseLegacyGroup', pubkeyHex]) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['eraseLegacyGroup']>
    >,
  // groups
  getGroup: async (pubkeyHex: GroupPubkeyType) =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'getGroup', pubkeyHex]) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['getGroup']>
    >,

  getAllGroups: async () =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'getAllGroups']) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['getAllGroups']>
    >,

  setGroup: async (pubkeyHex: GroupPubkeyType, lastRead: number, unread: boolean) =>
    callLibSessionWorker([
      'ConvoInfoVolatileConfig',
      'setGroup',
      pubkeyHex,
      lastRead,
      unread,
    ]) as Promise<ReturnType<ConvoInfoVolatileWrapperActionsCalls['setGroup']>>,

  eraseGroup: async (pubkeyHex: GroupPubkeyType) =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'eraseGroup', pubkeyHex]) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['eraseGroup']>
    >,

  // communities
  getCommunity: async (communityFullUrl: string) =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'getCommunity', communityFullUrl]) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['getCommunity']>
    >,

  getAllCommunities: async () =>
    callLibSessionWorker(['ConvoInfoVolatileConfig', 'getAllCommunities']) as Promise<
      ReturnType<ConvoInfoVolatileWrapperActionsCalls['getAllCommunities']>
    >,

  setCommunityByFullUrl: async (fullUrlWithPubkey: string, lastRead: number, unread: boolean) =>
    callLibSessionWorker([
      'ConvoInfoVolatileConfig',
      'setCommunityByFullUrl',
      fullUrlWithPubkey,
      lastRead,
      unread,
    ]) as Promise<ReturnType<ConvoInfoVolatileWrapperActionsCalls['setCommunityByFullUrl']>>,

  eraseCommunityByFullUrl: async (fullUrlWithOrWithoutPubkey: string) =>
    callLibSessionWorker([
      'ConvoInfoVolatileConfig',
      'eraseCommunityByFullUrl',
      fullUrlWithOrWithoutPubkey,
    ]) as Promise<ReturnType<ConvoInfoVolatileWrapperActionsCalls['eraseCommunityByFullUrl']>>,
};

export const MetaGroupWrapperActions: MetaGroupWrapperActionsCalls = {
  /** Shared actions */
  init: async (groupPk: GroupPubkeyType, options: GroupWrapperConstructor) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'init', options]) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['init']>
    >,

  free: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'free']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['free']>
    >,

  needsPush: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'needsPush']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['needsPush']>
    >,
  push: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'push']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['push']>
    >,
  needsDump: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'needsDump']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['needsDump']>
    >,
  metaDump: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'metaDump']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['metaDump']>
    >,
  metaMakeDump: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'metaMakeDump']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['metaMakeDump']>
    >,
  metaConfirmPushed: async (
    groupPk: GroupPubkeyType,
    args: Parameters<MetaGroupWrapperActionsCalls['metaConfirmPushed']>[1]
  ) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'metaConfirmPushed', args]) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['metaConfirmPushed']>
    >,
  metaMerge: async (
    groupPk: GroupPubkeyType,
    args: Parameters<MetaGroupWrapperActionsCalls['metaMerge']>[1]
  ) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'metaMerge', args]) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['metaMerge']>
    >,

  /** GroupInfo wrapper specific actions */
  infoGet: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'infoGet']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['infoGet']>
    >,
  infoSet: async (groupPk: GroupPubkeyType, infos: GroupInfoSet) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'infoSet', infos]) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['infoSet']>
    >,
  infoDestroy: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'infoDestroy']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['infoDestroy']>
    >,

  /** GroupMembers wrapper specific actions */
  memberGet: async (groupPk: GroupPubkeyType, pubkeyHex: PubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'memberGet', pubkeyHex]) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['memberGet']>
    >,
  memberGetOrConstruct: async (groupPk: GroupPubkeyType, pubkeyHex: PubkeyType) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'memberGetOrConstruct',
      pubkeyHex,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['memberGetOrConstruct']>>,
  memberConstructAndSet: async (groupPk: GroupPubkeyType, pubkeyHex: PubkeyType) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'memberConstructAndSet',
      pubkeyHex,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['memberConstructAndSet']>>,
  memberGetAll: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'memberGetAll']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['memberGetAll']>
    >,
  memberGetAllPendingRemovals: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'memberGetAllPendingRemovals']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['memberGetAllPendingRemovals']>
    >,
  memberEraseAndRekey: async (groupPk: GroupPubkeyType, members: Array<PubkeyType>) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'memberEraseAndRekey', members]) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['memberEraseAndRekey']>
    >,
  membersMarkPendingRemoval: async (
    groupPk: GroupPubkeyType,
    members: Array<PubkeyType>,
    withMessages: boolean
  ) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'membersMarkPendingRemoval',
      members,
      withMessages,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['membersMarkPendingRemoval']>>,
  memberSetInviteAccepted: async (groupPk: GroupPubkeyType, pubkeyHex: PubkeyType) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'memberSetInviteAccepted',
      pubkeyHex,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['memberSetInviteAccepted']>>,
  memberSetPromoted: async (groupPk: GroupPubkeyType, pubkeyHex: PubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'memberSetPromoted', pubkeyHex]) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['memberSetPromoted']>
    >,
  memberSetPromotionAccepted: async (groupPk: GroupPubkeyType, pubkeyHex: PubkeyType) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'memberSetPromotionAccepted',
      pubkeyHex,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['memberSetPromotionAccepted']>>,
  memberSetPromotionFailed: async (groupPk: GroupPubkeyType, pubkeyHex: PubkeyType) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'memberSetPromotionFailed',
      pubkeyHex,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['memberSetPromotionFailed']>>,
  memberSetPromotionSent: async (groupPk: GroupPubkeyType, pubkeyHex: PubkeyType) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'memberSetPromotionSent',
      pubkeyHex,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['memberSetPromotionSent']>>,

  memberSetInviteSent: async (groupPk: GroupPubkeyType, pubkeyHex: PubkeyType) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'memberSetInviteSent',
      pubkeyHex,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['memberSetInviteSent']>>,
  memberSetInviteNotSent: async (groupPk: GroupPubkeyType, pubkeyHex: PubkeyType) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'memberSetInviteNotSent',
      pubkeyHex,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['memberSetInviteNotSent']>>,
  memberSetInviteFailed: async (groupPk: GroupPubkeyType, pubkeyHex: PubkeyType) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'memberSetInviteFailed',
      pubkeyHex,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['memberSetInviteFailed']>>,
  memberSetNameTruncated: async (groupPk: GroupPubkeyType, pubkeyHex: PubkeyType, name: string) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'memberSetNameTruncated',
      pubkeyHex,
      name,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['memberSetNameTruncated']>>,
  memberSetSupplement: async (groupPk: GroupPubkeyType, pubkeyHex: PubkeyType) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'memberSetSupplement',
      pubkeyHex,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['memberSetSupplement']>>,
  memberSetProfilePicture: async (
    groupPk: GroupPubkeyType,
    pubkeyHex: PubkeyType,
    profilePicture: ProfilePicture
  ) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'memberSetProfilePicture',
      pubkeyHex,
      profilePicture,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['memberSetProfilePicture']>>,
  memberResetAllSendingState: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'memberResetAllSendingState']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['memberResetAllSendingState']>
    >,

  /** GroupKeys wrapper specific actions */
  keyRekey: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'keyRekey']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['keyRekey']>
    >,
  keysNeedsRekey: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'keysNeedsRekey']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['keysNeedsRekey']>
    >,
  keyGetAll: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'keyGetAll']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['keyGetAll']>
    >,
  activeHashes: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'activeHashes']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['activeHashes']>
    >,
  loadKeyMessage: async (
    groupPk: GroupPubkeyType,
    hash: string,
    data: Uint8Array,
    timestampMs: number
  ) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'loadKeyMessage',
      hash,
      data,
      timestampMs,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['loadKeyMessage']>>,
  keysAdmin: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'keysAdmin']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['keysAdmin']>
    >,
  keyGetCurrentGen: async (groupPk: GroupPubkeyType) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'keyGetCurrentGen']) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['keyGetCurrentGen']>
    >,
  encryptMessages: async (groupPk: GroupPubkeyType, plainTexts: Array<Uint8Array>) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'encryptMessages', plainTexts]) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['encryptMessages']>
    >,
  decryptMessage: async (groupPk: GroupPubkeyType, ciphertext: Uint8Array) =>
    callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'decryptMessage', ciphertext]) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['decryptMessage']>
    >,
  makeSwarmSubAccount: async (groupPk: GroupPubkeyType, memberPubkeyHex: PubkeyType) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'makeSwarmSubAccount',
      memberPubkeyHex,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['makeSwarmSubAccount']>>,
  generateSupplementKeys: async (groupPk: GroupPubkeyType, membersPubkeyHex: Array<PubkeyType>) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'generateSupplementKeys',
      membersPubkeyHex,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['generateSupplementKeys']>>,
  swarmSubaccountSign: async (
    groupPk: GroupPubkeyType,
    message: Uint8Array,
    authData: Uint8ArrayLen100
  ) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'swarmSubaccountSign',
      message,
      authData,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['swarmSubaccountSign']>>,
  swarmSubAccountToken: async (groupPk: GroupPubkeyType, memberPk: PubkeyType) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'swarmSubAccountToken',
      memberPk,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['swarmSubAccountToken']>>,
  swarmVerifySubAccount: async (groupPk: GroupPubkeyType, signingValue: Uint8ArrayLen100) =>
    callLibSessionWorker([
      `MetaGroupConfig-${groupPk}`,
      'swarmVerifySubAccount',
      signingValue,
    ]) as Promise<ReturnType<MetaGroupWrapperActionsCalls['swarmVerifySubAccount']>>,
  loadAdminKeys: async (groupPk: GroupPubkeyType, secret: Uint8ArrayLen64) => {
    return callLibSessionWorker([`MetaGroupConfig-${groupPk}`, 'loadAdminKeys', secret]) as Promise<
      ReturnType<MetaGroupWrapperActionsCalls['loadAdminKeys']>
    >;
  },
};

export const MultiEncryptWrapperActions: MultiEncryptActionsCalls = {
  /* Reuse the UserConfigWrapperActions with the UserConfig argument */
  ...createBaseActionsFor('UserConfig'),

  /** UserConfig wrapper specific actions */
  multiEncrypt: async args =>
    callLibSessionWorker(['MultiEncrypt', 'multiEncrypt', args]) as Promise<
      ReturnType<MultiEncryptActionsCalls['multiEncrypt']>
    >,
  multiDecryptEd25519: async args =>
    callLibSessionWorker(['MultiEncrypt', 'multiDecryptEd25519', args]) as Promise<
      ReturnType<MultiEncryptActionsCalls['multiDecryptEd25519']>
    >,
};

export const allKnownEncryptionDomains: Array<EncryptionDomain> = ['SessionGroupKickedMessage'];

export const BlindingActions: BlindingActionsCalls = {
  blindVersionPubkey: async (opts: Parameters<BlindingActionsCalls['blindVersionPubkey']>[0]) =>
    callLibSessionWorker(['Blinding', 'blindVersionPubkey', opts]) as Promise<
      ReturnType<BlindingActionsCalls['blindVersionPubkey']>
    >,
  blindVersionSign: async (opts: Parameters<BlindingActionsCalls['blindVersionSign']>[0]) =>
    callLibSessionWorker(['Blinding', 'blindVersionSign', opts]) as Promise<
      ReturnType<BlindingActionsCalls['blindVersionSign']>
    >,
  blindVersionSignRequest: async (
    opts: Parameters<BlindingActionsCalls['blindVersionSignRequest']>[0]
  ) =>
    callLibSessionWorker(['Blinding', 'blindVersionSignRequest', opts]) as Promise<
      ReturnType<BlindingActionsCalls['blindVersionSignRequest']>
    >,
};

export const UtilitiesActions: UtilitiesWrapperActionsCalls = {
  freeAllWrappers: async () => {
    await callLibSessionWorker(['Utilities', 'freeAllWrappers']);
  },
};

export const callLibSessionWorker = async (
  callToMake: LibSessionWorkerFunctions
): Promise<unknown> => {
  return internalCallLibSessionWorker(callToMake);
};
