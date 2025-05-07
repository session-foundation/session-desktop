/* eslint-disable consistent-return */
/* eslint-disable no-case-declarations */
import {
  BaseConfigWrapperNode,
  BlindingWrapperNode,
  ContactsConfigWrapperNode,
  ConvoInfoVolatileWrapperNode,
  GroupPubkeyType,
  MetaGroupWrapperNode,
  MultiEncryptWrapperNode,
  UserConfigWrapperNode,
  UserGroupsWrapperNode,
  UtilitiesWrapperNode,
} from 'libsession_util_nodejs';
import { isEmpty, isNull, isObject } from 'lodash';

import {
  BlindingConfig,
  ConfigWrapperGroup,
  ConfigWrapperObjectTypesMeta,
  ConfigWrapperUser,
  MetaGroupConfig,
  MultiEncryptConfig,
  isBlindingWrapperType,
  isMetaGroupWrapperType,
  isMultiEncryptWrapperType,
  isStaticSessionWrapper,
  isUserConfigWrapperType,
  isUtilitiesWrapperType,
  type UtilitiesConfig,
} from '../../browser/libsession_worker_functions';

/* eslint-disable no-console */
/* eslint-disable strict */

/**
 *
 * @param _x Looks like we need to duplicate this function here as we cannot import the existing one from a webworker context
 */
function assertUnreachable(_x: never, message: string): never {
  console.info(`assertUnreachable: Didn't expect to get here with "${message}"`);
  throw new Error("Didn't expect to get here");
}

// we can only have one of those so don't worry about storing them in a map for now
let userProfileWrapper: UserConfigWrapperNode | undefined;
let contactsConfigWrapper: ContactsConfigWrapperNode | undefined;
let userGroupsConfigWrapper: UserGroupsWrapperNode | undefined;
let convoInfoVolatileConfigWrapper: ConvoInfoVolatileWrapperNode | undefined;

const metaGroupWrappers: Map<GroupPubkeyType, MetaGroupWrapperNode> = new Map();

function getUserWrapper(type: ConfigWrapperUser): BaseConfigWrapperNode | undefined {
  switch (type) {
    case 'UserConfig':
      return userProfileWrapper;
    case 'ContactsConfig':
      return contactsConfigWrapper;
    case 'UserGroupsConfig':
      return userGroupsConfigWrapper;
    case 'ConvoInfoVolatileConfig':
      return convoInfoVolatileConfigWrapper;
    default:
      assertUnreachable(type, `getUserWrapper: Missing case error "${type}"`);
  }
}

function getGroupPubkeyFromWrapperType(type: ConfigWrapperGroup): GroupPubkeyType {
  assertGroupWrapperType(type);
  return type.substring(type.indexOf('-03') + 1) as GroupPubkeyType; // typescript is not yet smart enough
}

function getGroupWrapper(type: ConfigWrapperGroup): MetaGroupWrapperNode | undefined {
  assertGroupWrapperType(type);

  if (isMetaGroupWrapperType(type)) {
    const pk = getGroupPubkeyFromWrapperType(type);

    return metaGroupWrappers.get(pk);
  }
  assertUnreachable(type, `getGroupWrapper: Missing case error "${type}"`);
}

function getCorrespondingUserWrapper(wrapperType: ConfigWrapperUser): BaseConfigWrapperNode {
  if (isUserConfigWrapperType(wrapperType)) {
    switch (wrapperType) {
      case 'UserConfig':
      case 'ContactsConfig':
      case 'UserGroupsConfig':
      case 'ConvoInfoVolatileConfig':
        const wrapper = getUserWrapper(wrapperType);
        if (!wrapper) {
          throw new Error(`UserWrapper: ${wrapperType} is not init yet`);
        }
        return wrapper;
      default:
        assertUnreachable(
          wrapperType,
          `getCorrespondingUserWrapper: Missing case error "${wrapperType}"`
        );
    }
  }

  assertUnreachable(
    wrapperType,
    `getCorrespondingUserWrapper missing global handling for "${wrapperType}"`
  );
}

function getCorrespondingGroupWrapper(wrapperType: MetaGroupConfig): MetaGroupWrapperNode {
  if (isMetaGroupWrapperType(wrapperType)) {
    const wrapper = getGroupWrapper(wrapperType);
    if (!wrapper) {
      throw new Error(`GroupWrapper: ${wrapperType} is not init yet`);
    }
    return wrapper;
  }
  assertUnreachable(
    wrapperType,
    `getCorrespondingGroupWrapper missing global handling for "${wrapperType}"`
  );
}

function getMultiEncryptWrapper(wrapperType: MultiEncryptConfig): MultiEncryptWrapperNode {
  if (isMultiEncryptWrapperType(wrapperType)) {
    return MultiEncryptWrapperNode;
  }
  assertUnreachable(wrapperType, `getMultiEncrypt missing global handling for "${wrapperType}"`);
}

function getBlindingWrapper(wrapperType: BlindingConfig): BlindingWrapperNode {
  if (isBlindingWrapperType(wrapperType)) {
    return BlindingWrapperNode;
  }
  assertUnreachable(wrapperType, `getBlindingWrapper missing global handling for "${wrapperType}"`);
}

function getUtilitiesWrapper(wrapperType: UtilitiesConfig): UtilitiesWrapperNode {
  if (isUtilitiesWrapperType(wrapperType)) {
    return UtilitiesWrapperNode;
  }
  assertUnreachable(
    wrapperType,
    `getUtilitiesWrapper missing global handling for "${wrapperType}"`
  );
}

function isUInt8Array(value: unknown): value is Uint8Array {
  return isObject(value) && value.constructor === Uint8Array;
}

function assertUserWrapperType(wrapperType: ConfigWrapperObjectTypesMeta): ConfigWrapperUser {
  if (!isUserConfigWrapperType(wrapperType)) {
    throw new Error(`wrapperType "${wrapperType} is not of type User"`);
  }
  return wrapperType;
}

function assertGroupWrapperType(wrapperType: ConfigWrapperObjectTypesMeta): ConfigWrapperGroup {
  if (!isMetaGroupWrapperType(wrapperType)) {
    throw new Error(`wrapperType "${wrapperType} is not of type Group"`);
  }
  return wrapperType;
}

/**
 * This function can be used to initialize a wrapper which takes the private ed25519 key of the user and a dump as argument.
 */
function initUserWrapper(options: Array<unknown>, wrapperType: ConfigWrapperUser) {
  const userType = assertUserWrapperType(wrapperType);

  const wrapper = getUserWrapper(wrapperType);
  if (wrapper) {
    throw new Error(`${wrapperType} already init`);
  }
  if (options.length !== 2) {
    throw new Error(`${wrapperType} init needs two arguments`);
  }
  const [edSecretKey, dump] = options;

  if (isEmpty(edSecretKey) || !isUInt8Array(edSecretKey)) {
    throw new Error(`${wrapperType} init needs a valid edSecretKey`);
  }

  if (!isNull(dump) && !isUInt8Array(dump)) {
    throw new Error(`${wrapperType} init needs a valid dump`);
  }
  switch (userType) {
    case 'UserConfig':
      userProfileWrapper = new UserConfigWrapperNode(edSecretKey, dump);
      break;
    case 'ContactsConfig':
      contactsConfigWrapper = new ContactsConfigWrapperNode(edSecretKey, dump);
      break;
    case 'UserGroupsConfig':
      userGroupsConfigWrapper = new UserGroupsWrapperNode(edSecretKey, dump);
      break;
    case 'ConvoInfoVolatileConfig':
      convoInfoVolatileConfigWrapper = new ConvoInfoVolatileWrapperNode(edSecretKey, dump);
      break;
    default:
      assertUnreachable(userType, `initUserWrapper: Missing case error "${userType}"`);
  }
}

/**
 *  * This function is used to free wrappers from memory only
 *
 * NOTE only use this function for wrappers that have not been saved to the database.
 *
 * EXAMPLE When restoring an account and fetching the display name of a user. We want to fetch a UserProfile config message and make a temporary wrapper for it in order to look up the display name.
 */
function freeUserWrapper(wrapperType: ConfigWrapperObjectTypesMeta) {
  const userWrapperType = assertUserWrapperType(wrapperType);

  switch (userWrapperType) {
    case 'UserConfig':
      userProfileWrapper = undefined;
      break;
    case 'ContactsConfig':
      contactsConfigWrapper = undefined;
      break;
    case 'UserGroupsConfig':
      userGroupsConfigWrapper = undefined;
      break;
    case 'ConvoInfoVolatileConfig':
      convoInfoVolatileConfigWrapper = undefined;
      break;
    default:
      assertUnreachable(
        userWrapperType,
        `freeUserWrapper: Missing case error "${userWrapperType}"`
      );
  }
}

/*
 * This function can be used to initialize a group wrapper
 */
function initGroupWrapper(options: Array<unknown>, wrapperType: ConfigWrapperGroup) {
  const groupType = assertGroupWrapperType(wrapperType);

  const wrapper = getGroupWrapper(wrapperType);
  if (wrapper) {
    // console.warn(`group: "${wrapperType}" already init`);
    return;
  }

  if (options.length !== 1 || !isObject(options[0])) {
    throw new Error(`group: "${wrapperType}" init needs 1 arguments`);
  }
  const firstArg = options[0];
  if (
    !isObject(firstArg) ||
    !('groupEd25519Pubkey' in firstArg) ||
    !('groupEd25519Secretkey' in firstArg) ||
    !('metaDumped' in firstArg) ||
    !('userEd25519Secretkey' in firstArg)
  ) {
    throw new Error(
      `group: "${wrapperType}" firstArg is not obj type, or missing some keys, or not the correct keys`
    );
  }
  // we need all the fields defined in GroupWrapperConstructor, but the function in the wrapper will throw if we don't forward what's needed

  const { groupEd25519Pubkey, groupEd25519Secretkey, metaDumped, userEd25519Secretkey } = firstArg;

  if (
    !isUInt8Array(groupEd25519Pubkey) ||
    (!isUInt8Array(groupEd25519Secretkey) && !isNull(groupEd25519Secretkey)) ||
    (!isUInt8Array(metaDumped) && !isNull(metaDumped)) ||
    !isUInt8Array(userEd25519Secretkey)
  ) {
    throw new Error(`group: "${wrapperType}" type of keys is not correct`);
  }

  if (isMetaGroupWrapperType(groupType)) {
    const pk = getGroupPubkeyFromWrapperType(groupType);
    const justCreated = new MetaGroupWrapperNode({
      groupEd25519Pubkey,
      groupEd25519Secretkey,
      metaDumped,
      userEd25519Secretkey,
    });

    metaGroupWrappers.set(pk, justCreated);
    return;
  }
  assertUnreachable(groupType, `initGroupWrapper: Missing case error "${groupType}"`);
}

function freeAllWrappers() {
  userProfileWrapper = undefined;
  contactsConfigWrapper = undefined;
  userGroupsConfigWrapper = undefined;
  convoInfoVolatileConfigWrapper = undefined;

  metaGroupWrappers.clear();
}

onmessage = async (e: {
  data: [number, ConfigWrapperObjectTypesMeta | 'Blinding', string, ...any];
}) => {
  const [jobId, config, action, ...args] = e.data;

  try {
    if (action === 'init') {
      if (isStaticSessionWrapper(config)) {
        // nothing to do for the blinding/multiEncrypt/utilities wrapper, all functions are static
        postMessage([jobId, null, null]);
        return;
      }
      if (isUserConfigWrapperType(config)) {
        initUserWrapper(args, config);
        postMessage([jobId, null, null]);
        return;
      }
      if (isMetaGroupWrapperType(config)) {
        initGroupWrapper(args, config);
        postMessage([jobId, null, null]);
        return;
      }
      assertUnreachable(config, `Unhandled init wrapper type: ${config}`);
    }
    if (action === 'free') {
      if (isStaticSessionWrapper(config)) {
        // nothing to do for the blinding/multiEncrypt/utilities wrapper, all functions are static
        postMessage([jobId, null, null]);
        return;
      }
      if (isUserConfigWrapperType(config)) {
        freeUserWrapper(config);
        postMessage([jobId, null, null]);
        return;
      }
      if (isMetaGroupWrapperType(config)) {
        const pk = getGroupPubkeyFromWrapperType(config);
        metaGroupWrappers.delete(pk);
        postMessage([jobId, null, null]);
        return;
      }
      assertUnreachable(config, `Unhandled free wrapper type: ${config}`);
    }
    if (action === 'freeAllWrappers') {
      freeAllWrappers();
      postMessage([jobId, null, null]);
      return;
    }

    const wrapper = isUserConfigWrapperType(config)
      ? getCorrespondingUserWrapper(config)
      : isMetaGroupWrapperType(config)
        ? getCorrespondingGroupWrapper(config)
        : isMultiEncryptWrapperType(config)
          ? getMultiEncryptWrapper(config)
          : isBlindingWrapperType(config)
            ? getBlindingWrapper(config)
            : isUtilitiesWrapperType(config)
              ? getUtilitiesWrapper(config)
              : undefined;
    if (!wrapper) {
      throw new Error(`did not find an already built (or static) wrapper for config: "${config}"`);
    }
    const fn = (wrapper as any)[action];

    if (!fn) {
      throw new Error(
        `Worker: job "${jobId}" did not find function "${action}" on config "${config}"`
      );
    }
    const result = await (wrapper as any)[action](...args);

    postMessage([jobId, null, result]);
  } catch (error) {
    const errorForDisplay = prepareErrorForPostMessage(error);
    postMessage([jobId, errorForDisplay]);
  }
};

function prepareErrorForPostMessage(error: unknown) {
  if (!error) {
    return null;
  }

  // if (error.stack) {
  //   return error.stack;
  // }

  return isObject(error) && 'message' in error
    ? error.message
    : 'prepareErrorForPostMessage: unknown error';
}
