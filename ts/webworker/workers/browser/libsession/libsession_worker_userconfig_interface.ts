import { isEqual } from 'lodash';
import type { UserConfigWrapperActionsCalls } from 'libsession_util_nodejs';
import { callLibSessionWorker } from '../libsession_worker_interface';
import type { AwaitedReturn } from '../../../../types/sqlSharedTypes';
import { createUserBaseActionsFor } from './user_base_actions';

type CachedUserConfig = {
  priority: AwaitedReturn<UserConfigWrapperActionsCalls['getPriority']>;
  name: AwaitedReturn<UserConfigWrapperActionsCalls['getName']>;
  profilePic: AwaitedReturn<UserConfigWrapperActionsCalls['getProfilePic']>;
  profileUpdatedSeconds: AwaitedReturn<UserConfigWrapperActionsCalls['getProfileUpdatedSeconds']>;
  enableBlindedMsgRequest: AwaitedReturn<
    UserConfigWrapperActionsCalls['getEnableBlindedMsgRequest']
  >;
  noteToSelfExpirySeconds: AwaitedReturn<UserConfigWrapperActionsCalls['getNoteToSelfExpiry']>;
  proConfig: AwaitedReturn<UserConfigWrapperActionsCalls['getProConfig']>;
  proProfileBitset: AwaitedReturn<UserConfigWrapperActionsCalls['getProProfileBitset']>;
  proAccessExpiry: AwaitedReturn<UserConfigWrapperActionsCalls['getProAccessExpiry']>;
  refundRequested: AwaitedReturn<UserConfigWrapperActionsCalls['getRefundRequested']>;
  proPrepaid: AwaitedReturn<UserConfigWrapperActionsCalls['getProPrepaid']>;
  proAutoRenewing: AwaitedReturn<UserConfigWrapperActionsCalls['getProAutoRenewing']>;
  proGracePeriod: AwaitedReturn<UserConfigWrapperActionsCalls['getProGracePeriod']>;
};

let cachedUserConfig: CachedUserConfig | null = null;

/**
 * Fully refresh the cachedUserConfig with what is currently stored in libsession.
 * Note: we cannot do a partial refresh as some fields are inter dependent.
 * And writing those dependencies here would break when libsession gets updated.
 * With libsession-wasm, it would just work though.
 */
async function fullRefreshCachedUserConfig() {
  const priority = await UserConfigWrapperActions.getPriority();
  const name = await UserConfigWrapperActions.getName();
  const profilePic = await UserConfigWrapperActions.getProfilePic();
  const profileUpdatedSeconds = await UserConfigWrapperActions.getProfileUpdatedSeconds();
  const enableBlindedMsgRequest = await UserConfigWrapperActions.getEnableBlindedMsgRequest();
  const noteToSelfExpirySeconds = await UserConfigWrapperActions.getNoteToSelfExpiry();
  const proConfig = await UserConfigWrapperActions.getProConfig();
  const proProfileBitset = await UserConfigWrapperActions.getProProfileBitset();
  const proAccessExpiry = await UserConfigWrapperActions.getProAccessExpiry();
  const refundRequested = await UserConfigWrapperActions.getRefundRequested();
  const proPrepaid = await UserConfigWrapperActions.getProPrepaid();
  const proAutoRenewing = await UserConfigWrapperActions.getProAutoRenewing();
  const proGracePeriod = await UserConfigWrapperActions.getProGracePeriod();

  if (!cachedUserConfig) {
    cachedUserConfig = {
      enableBlindedMsgRequest,
      noteToSelfExpirySeconds,
      proAccessExpiry,
      proConfig,
      proProfileBitset,
      refundRequested,
      proPrepaid,
      proAutoRenewing,
      proGracePeriod,
      profilePic,
      profileUpdatedSeconds,
      priority,
      name,
    };
    return;
  }
  applyUserConfigIfChanged('priority', priority);
  applyUserConfigIfChanged('name', name);
  applyUserConfigIfChanged('profilePic', profilePic);
  applyUserConfigIfChanged('profileUpdatedSeconds', profileUpdatedSeconds);
  applyUserConfigIfChanged('enableBlindedMsgRequest', enableBlindedMsgRequest);
  applyUserConfigIfChanged('noteToSelfExpirySeconds', noteToSelfExpirySeconds);
  applyUserConfigIfChanged('proConfig', proConfig);
  applyUserConfigIfChanged('proProfileBitset', proProfileBitset);
  applyUserConfigIfChanged('proAccessExpiry', proAccessExpiry);
  applyUserConfigIfChanged('refundRequested', refundRequested);
  applyUserConfigIfChanged('proPrepaid', proPrepaid);
  applyUserConfigIfChanged('proAutoRenewing', proAutoRenewing);
  applyUserConfigIfChanged('proGracePeriod', proGracePeriod);
}

function applyUserConfigIfChanged<T extends keyof CachedUserConfig>(
  key: T,
  value: CachedUserConfig[T]
) {
  if (!cachedUserConfig) {
    throw new Error(`applyIfChanged for "${key}" called without cachedUserConfig`);
  }
  if (!isEqual(cachedUserConfig[key], value)) {
    cachedUserConfig[key] = value;
  }
}

export function getCachedUserConfig() {
  if (!cachedUserConfig) {
    throw new Error('getCachedUserConfig: cachedUserConfig is not set');
  }
  return cachedUserConfig;
}

/**
 * Make a call to the userconfig libsession and refresh the stored state.
 * Note: this should only be called for actions modifying the data (i.e. merge/set/removal/etc).
 * If you add it as part of a get, this will become a recursive bomb.
 */
async function callLibsessionWithUserConfigRefresh<T>(
  args: Parameters<typeof callLibSessionWorker>[0]
): Promise<T> {
  const result = (await callLibSessionWorker(args)) as T;
  await fullRefreshCachedUserConfig();
  return result;
}

export const UserConfigWrapperActions: UserConfigWrapperActionsCalls = {
  /* Reuse the UserConfigWrapperActions with the UserConfig argument */
  ...createUserBaseActionsFor('UserConfig', fullRefreshCachedUserConfig),

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
  setPriority: async (...args) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setPriority', ...args]);
  },
  setName: async (...args) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setName', ...args]);
  },
  setNameTruncated: async (...args) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setNameTruncated', ...args]);
  },
  setNewProfilePic: async (...args) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setNewProfilePic', ...args]);
  },
  setReuploadProfilePic: async (...args) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setReuploadProfilePic', ...args]);
  },
  getProfileUpdatedSeconds: async () =>
    callLibSessionWorker(['UserConfig', 'getProfileUpdatedSeconds']) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getProfileUpdatedSeconds']>
    >,
  getEnableBlindedMsgRequest: async () =>
    callLibSessionWorker(['UserConfig', 'getEnableBlindedMsgRequest']) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getEnableBlindedMsgRequest']>
    >,
  setEnableBlindedMsgRequest: async (...args) => {
    return callLibsessionWithUserConfigRefresh([
      'UserConfig',
      'setEnableBlindedMsgRequest',
      ...args,
    ]);
  },
  getNoteToSelfExpiry: async () =>
    callLibSessionWorker(['UserConfig', 'getNoteToSelfExpiry']) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getNoteToSelfExpiry']>
    >,
  setNoteToSelfExpiry: async (...args) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setNoteToSelfExpiry', ...args]);
  },
  getProConfig: async () =>
    callLibSessionWorker(['UserConfig', 'getProConfig']) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getProConfig']>
    >,
  setProConfig: async (...args) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setProConfig', ...args]);
  },
  removeProConfig: async (...args) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'removeProConfig', ...args]);
  },

  getProProfileBitset: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['getProProfileBitset']>
  ) =>
    callLibSessionWorker(['UserConfig', 'getProProfileBitset', ...args]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getProProfileBitset']>
    >,
  getProAccessExpiry: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['getProAccessExpiry']>
  ) =>
    callLibSessionWorker(['UserConfig', 'getProAccessExpiry', ...args]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getProAccessExpiry']>
    >,
  setProBadge: async (...args: Parameters<UserConfigWrapperActionsCalls['setProBadge']>) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setProBadge', ...args]);
  },
  setAnimatedAvatar: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['setAnimatedAvatar']>
  ) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setAnimatedAvatar', ...args]);
  },
  setProAccessExpiry: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['setProAccessExpiry']>
  ) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setProAccessExpiry', ...args]);
  },
  getProAutoRenewing: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['getProAutoRenewing']>
  ) =>
    callLibSessionWorker(['UserConfig', 'getProAutoRenewing', ...args]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getProAutoRenewing']>
    >,
  setProAutoRenewing: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['setProAutoRenewing']>
  ) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setProAutoRenewing', ...args]);
  },
  getProGracePeriod: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['getProGracePeriod']>
  ) =>
    callLibSessionWorker(['UserConfig', 'getProGracePeriod', ...args]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getProGracePeriod']>
    >,
  setProGracePeriod: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['setProGracePeriod']>
  ) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setProGracePeriod', ...args]);
  },

  generateProMasterKey: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['generateProMasterKey']>
  ) =>
    callLibSessionWorker(['UserConfig', 'generateProMasterKey', ...args]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['generateProMasterKey']>
    >,
  generateRotatingPrivKeyHex: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['generateRotatingPrivKeyHex']>
  ) =>
    callLibSessionWorker(['UserConfig', 'generateRotatingPrivKeyHex', ...args]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['generateRotatingPrivKeyHex']>
    >,
  deriveProRotatingKey: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['deriveProRotatingKey']>
  ) =>
    callLibSessionWorker(['UserConfig', 'deriveProRotatingKey', ...args]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['deriveProRotatingKey']>
    >,
  getRefundRequested: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['getRefundRequested']>
  ) =>
    callLibSessionWorker(['UserConfig', 'getRefundRequested', ...args]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getRefundRequested']>
    >,
  setRefundRequested: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['setRefundRequested']>
  ) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setRefundRequested', ...args]);
  },
  getProPrepaid: async (...args: Parameters<UserConfigWrapperActionsCalls['getProPrepaid']>) =>
    callLibSessionWorker(['UserConfig', 'getProPrepaid', ...args]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getProPrepaid']>
    >,
  setProPrepaid: async (...args: Parameters<UserConfigWrapperActionsCalls['setProPrepaid']>) => {
    return callLibsessionWithUserConfigRefresh(['UserConfig', 'setProPrepaid', ...args]);
  },
  getProRenewalTarget: async (
    ...args: Parameters<UserConfigWrapperActionsCalls['getProRenewalTarget']>
  ) =>
    callLibSessionWorker(['UserConfig', 'getProRenewalTarget', ...args]) as Promise<
      ReturnType<UserConfigWrapperActionsCalls['getProRenewalTarget']>
    >,
};
