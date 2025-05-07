/* eslint-disable no-await-in-loop */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import { GroupPubkeyType, PubkeyType } from 'libsession_util_nodejs';
import { from_hex, to_hex } from 'libsodium-wrappers-sumo';
import { compact, difference, flatten, isEmpty, isNil, isString, omit } from 'lodash';
import Long from 'long';
import { UserUtils } from '..';
import { ConfigDumpData } from '../../../data/configDump/configDump';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import {
  ConfigWrapperUser,
  isUserConfigWrapperType,
} from '../../../webworker/workers/browser/libsession_worker_functions';
import {
  UserGenericWrapperActions,
  MetaGroupWrapperActions,
  UtilitiesActions,
} from '../../../webworker/workers/browser/libsession_worker_interface';
import {
  SnodeNamespace,
  SnodeNamespaces,
  SnodeNamespacesUserConfig,
} from '../../apis/snode_api/namespaces';
import {
  BatchResultEntry,
  NotEmptyArrayOfBatchResults,
} from '../../apis/snode_api/BatchResultEntry';
import { PubKey } from '../../types';
import { ed25519Str } from '../String';
import type { WithMessageHash } from '../../types/with';

const requiredUserVariants: Array<ConfigWrapperUser> = [
  'UserConfig',
  'ContactsConfig',
  'UserGroupsConfig',
  'ConvoInfoVolatileConfig',
];

/**
 * Initializes the libsession wrappers for the required user variants if the dumps are not already in the database. It will use an empty dump if the dump is not found.
 */
async function initializeLibSessionUtilWrappers() {
  const keypair = await UserUtils.getUserED25519KeyPairBytes();
  if (!keypair || !keypair.privKeyBytes) {
    throw new Error('edkeypair not found for current user');
  }
  const privateKeyEd25519 = keypair.privKeyBytes;
  await UtilitiesActions.freeAllWrappers();

  // fetch the dumps we already have from the database
  const dumps = await ConfigDumpData.getAllDumpsWithData();
  window.log.info(
    'initializeLibSessionUtilWrappers alldumpsInDB already: ',
    JSON.stringify(dumps.map(m => omit(m, 'data')))
  );

  const userVariantsBuildWithoutErrors = new Set<ConfigWrapperUser>();

  // load the dumps retrieved from the database into their corresponding wrappers
  for (let index = 0; index < dumps.length; index++) {
    const dump = dumps[index];
    const variant = dump.variant;
    if (!isUserConfigWrapperType(variant)) {
      continue;
    }
    window.log.debug(
      `initializeLibSessionUtilWrappers initing from dump "${variant}", length: ${dump.data.length}: ${to_hex(dump.data)}`
    );
    try {
      await UserGenericWrapperActions.init(
        variant,
        privateKeyEd25519,
        dump.data.length ? dump.data : null
      );

      userVariantsBuildWithoutErrors.add(variant);
    } catch (e) {
      window.log.warn(`init of UserConfig failed with ${e.message} `);
      throw new Error(`initializeLibSessionUtilWrappers failed with ${e.message}`);
    }
  }

  const missingRequiredVariants: Array<ConfigWrapperUser> = difference(
    LibSessionUtil.requiredUserVariants,
    [...userVariantsBuildWithoutErrors.values()]
  );

  for (let index = 0; index < missingRequiredVariants.length; index++) {
    const missingVariant = missingRequiredVariants[index];
    window.log.warn(
      `initializeLibSessionUtilWrappers: missingRequiredVariants "${missingVariant}"`
    );
    await UserGenericWrapperActions.init(missingVariant, privateKeyEd25519, null);
    // save the newly created dump to the database even if it is empty, just so we do not need to recreate one next run

    const dump = await UserGenericWrapperActions.dump(missingVariant);
    await ConfigDumpData.saveConfigDump({
      data: dump,
      publicKey: UserUtils.getOurPubKeyStrFromCache(),
      variant: missingVariant,
    });
    window.log.debug(
      `initializeLibSessionUtilWrappers: missingRequiredVariants "${missingVariant}" created`
    );
  }

  // No need to load the meta group wrapper here. We will load them once the SessionInbox is loaded with a redux action
}

type PendingChangesShared = {
  ciphertexts: Array<Uint8Array>;
  /**
   * seqno is allowed to be null here because the group keys wrapper does not have a seqno.
   */
  seqno: Long | null;
};

export type PendingChangesForUs = PendingChangesShared & {
  namespace: SnodeNamespacesUserConfig;
};

type PendingChangesForGroupNonKey = PendingChangesShared & {
  namespace: SnodeNamespaces.ClosedGroupInfo | SnodeNamespaces.ClosedGroupMembers;
};

type PendingChangesForGroupKey = PendingChangesShared & {
  namespace: SnodeNamespaces.ClosedGroupKeys;
};

export type PendingChangesForGroup = PendingChangesForGroupNonKey | PendingChangesForGroupKey;

export type UserDestinationChanges = {
  messages: Array<PendingChangesForUs>;
  allOldHashes: Set<string>;
};

export type GroupDestinationChanges = {
  messages: Array<PendingChangesForGroup>;
  allOldHashes: Set<string>;
};

export type UserSuccessfulChange = WithMessageHash & {
  pushed: Pick<PendingChangesForUs, 'namespace' | 'seqno'>;
};

type KeysGroupSuccessfulChange = WithMessageHash & {
  pushed: Pick<PendingChangesForGroupKey, 'namespace'>;
};

type NonKeysGroupSuccessfulChange = WithMessageHash & {
  pushed: Pick<PendingChangesForGroupNonKey, 'namespace' | 'seqno'>;
};

export type GroupSuccessfulChange = KeysGroupSuccessfulChange | NonKeysGroupSuccessfulChange;

/**
 * Fetch what needs to be pushed for all of the current user's wrappers.
 */
async function pendingChangesForUs(): Promise<UserDestinationChanges> {
  const results: UserDestinationChanges = { messages: [], allOldHashes: new Set() };
  const variantsNeedingPush = new Set<ConfigWrapperUser>();
  const userVariants = LibSessionUtil.requiredUserVariants;

  for (let index = 0; index < userVariants.length; index++) {
    const variant = userVariants[index];

    const needsPush = await UserGenericWrapperActions.needsPush(variant);
    if (!needsPush) {
      continue;
    }

    const { data, seqno, hashes, namespace } = await UserGenericWrapperActions.push(variant);
    variantsNeedingPush.add(variant);
    results.messages.push({
      ciphertexts: data,
      seqno: Long.fromNumber(seqno),
      namespace,
    });

    hashes.forEach(h => results.allOldHashes.add(h)); // add all the hashes to the set
  }
  if (variantsNeedingPush.size > 0) {
    window.log.info(`those user variants needs push: "${[...variantsNeedingPush]}"`);
  }

  return results;
}

/**
 * Fetch what needs to be pushed for the specified group public key.
 * @param groupPk the public key of the group to fetch the details off
 * @returns an object with a list of messages to be pushed and the list of hashes to bump expiry, server side
 */
async function pendingChangesForGroup(groupPk: GroupPubkeyType): Promise<GroupDestinationChanges> {
  if (!PubKey.is03Pubkey(groupPk)) {
    throw new Error(`pendingChangesForGroup only works for user or 03 group pubkeys`);
  }
  // one of the wrapper behind the metagroup needs a push
  const needsPush = await MetaGroupWrapperActions.needsPush(groupPk);

  if (!needsPush) {
    return { messages: [], allOldHashes: new Set() };
  }
  const { groupInfo, groupMember, groupKeys } = await MetaGroupWrapperActions.push(groupPk);
  const results = new Array<PendingChangesForGroup>();

  // Note: We need the keys to be pushed first to avoid a race condition
  if (groupKeys) {
    results.push({
      ciphertexts: [groupKeys.data],
      namespace: groupKeys.namespace,
      seqno: null,
    });
  }

  if (groupInfo) {
    results.push({
      ciphertexts: groupInfo.data,
      seqno: Long.fromNumber(groupInfo.seqno),
      namespace: groupInfo.namespace,
    });
  }
  if (groupMember) {
    results.push({
      ciphertexts: groupMember.data,
      seqno: Long.fromNumber(groupMember.seqno),
      namespace: groupMember.namespace,
    });
  }
  window.log.debug(
    `${ed25519Str(groupPk)} those group variants needs push: "${SnodeNamespace.toRoles(results.map(m => m.namespace))}"`
  );

  const memberHashes = compact(groupMember?.hashes) || [];
  const infoHashes = compact(groupInfo?.hashes) || [];
  const allOldHashes = new Set([...infoHashes, ...memberHashes]);

  return { messages: results, allOldHashes };
}

/**
 * Return the wrapperId associated with a specific namespace.
 * WrapperIds are what we use in the database and with the libsession workers calls, and namespace is what we push to.
 */
function userNamespaceToVariant(namespace: SnodeNamespacesUserConfig) {
  // TODO Might be worth migrating them to use directly the namespaces?
  switch (namespace) {
    case SnodeNamespaces.UserProfile:
      return 'UserConfig';
    case SnodeNamespaces.UserContacts:
      return 'ContactsConfig';
    case SnodeNamespaces.UserGroups:
      return 'UserGroupsConfig';
    case SnodeNamespaces.ConvoInfoVolatile:
      return 'ConvoInfoVolatileConfig';
    default:
      assertUnreachable(namespace, `userNamespaceToVariant: Unsupported namespace: "${namespace}"`);
      throw new Error('userNamespaceToVariant: Unsupported namespace:'); // ts is not happy without this
  }
}

function hashOfResultShouldBeIncluded({
  batchResult,
  ciphertext,
}: {
  ciphertext?: Uint8Array;
  batchResult?: BatchResultEntry;
}) {
  const hash = batchResult?.body?.hash;
  if (
    batchResult &&
    batchResult.code === 200 &&
    isString(hash) &&
    !isEmpty(hash) &&
    ciphertext?.length
  ) {
    return hash;
  }
  return null;
}

function findMatchingIndexes<T>(
  array: Array<T>,
  predicate: (value: T, index: number, array: Array<T>) => boolean
) {
  const result: Array<number> = [];
  array.forEach((value, index) => {
    if (predicate(value, index, array)) {
      result.push(index);
    }
  });
  return result;
}

type FlattenedDataSentKeyItem = Omit<PendingChangesForGroupKey, 'ciphertexts'> & {
  ciphertext: Uint8Array;
};

type FlattenedDataSentNonKeyItem = Omit<PendingChangesForGroupNonKey, 'ciphertexts'> & {
  ciphertext: Uint8Array;
};

type FlattenedDataSentUserItem = Omit<PendingChangesForUs, 'ciphertexts'> & {
  ciphertext: Uint8Array;
};

type FlattenedDataSentGroupItem = FlattenedDataSentKeyItem | FlattenedDataSentNonKeyItem;

function isFlattenedItemGroupNonKeyChange(
  change: FlattenedDataSentGroupItem
): change is FlattenedDataSentNonKeyItem {
  return change.namespace !== SnodeNamespaces.ClosedGroupKeys;
}

function nonGroupKeysMultiPartDetailsToConfirmPushed({
  flatContentSent,
  namespace,
  result,
}: {
  result: NotEmptyArrayOfBatchResults;
  flatContentSent: Array<FlattenedDataSentGroupItem>;
  namespace: SnodeNamespaces.ClosedGroupInfo | SnodeNamespaces.ClosedGroupMembers;
}) {
  const indexes = findMatchingIndexes(flatContentSent, m => m.namespace === namespace);
  if (!indexes.length) {
    return [];
  }
  const firstItem = flatContentSent[indexes[0]];
  if (!firstItem) {
    return [];
  }
  if (!isFlattenedItemGroupNonKeyChange(firstItem)) {
    return [];
  }
  if (isNil(firstItem.seqno)) {
    return [];
  }
  const seqno = firstItem.seqno;

  const allHashesToConfirm = compact(
    indexes.map(i => {
      const dataSent = flatContentSent[i];
      const hashIfShouldBeIncluded = hashOfResultShouldBeIncluded({
        batchResult: result?.[i],
        ciphertext: dataSent.ciphertext,
      });
      return hashIfShouldBeIncluded;
    })
  );

  const multiPartSuccessfulChanges: Array<NonKeysGroupSuccessfulChange> = [];

  if (allHashesToConfirm.length === indexes.length) {
    const toConfirmPushed = allHashesToConfirm.map(hash => ({
      pushed: { namespace, seqno },
      messageHash: hash,
    }));
    multiPartSuccessfulChanges.push(...toConfirmPushed);
  }
  return multiPartSuccessfulChanges;
}

function userMultiPartDetailsToConfirmPushed({
  flatContentSent,
  namespace,
  result,
}: {
  result: NotEmptyArrayOfBatchResults;
  flatContentSent: Array<FlattenedDataSentUserItem>;
  namespace: SnodeNamespacesUserConfig;
}) {
  const indexes = findMatchingIndexes(flatContentSent, m => m.namespace === namespace);
  if (!indexes.length) {
    return [];
  }
  const firstItem = flatContentSent[indexes[0]];
  if (!firstItem) {
    return [];
  }
  const seqno = firstItem.seqno;
  if (isNil(seqno)) {
    return [];
  }

  const allHashesToConfirm = compact(
    indexes.map(i => {
      const dataSent = flatContentSent[i];
      const hashIfShouldBeIncluded = hashOfResultShouldBeIncluded({
        batchResult: result?.[i],
        ciphertext: dataSent.ciphertext,
      });
      return hashIfShouldBeIncluded;
    })
  );

  const multiPartSuccessfulChanges: Array<UserSuccessfulChange> = [];

  if (allHashesToConfirm.length === indexes.length) {
    const toConfirmPushed = allHashesToConfirm.map(hash => ({
      pushed: { namespace, seqno },
      messageHash: hash,
    }));
    multiPartSuccessfulChanges.push(...toConfirmPushed);
  }
  return multiPartSuccessfulChanges;
}

function keysMultiPartDetailsToConfirmPushed(
  result: NotEmptyArrayOfBatchResults,
  flatContentSent: Array<FlattenedDataSentGroupItem>
) {
  const indexes = findMatchingIndexes(
    flatContentSent,
    m => m.namespace === SnodeNamespaces.ClosedGroupKeys
  );
  const allHashesToConfirm = compact(
    indexes.map(i => {
      const dataSent = flatContentSent[i];
      const hashIfShouldBeIncluded = hashOfResultShouldBeIncluded({
        batchResult: result?.[i],
        ciphertext: dataSent.ciphertext,
      });
      return hashIfShouldBeIncluded;
    })
  );

  const multiPartSuccessfulChanges: Array<KeysGroupSuccessfulChange> = [];
  if (allHashesToConfirm.length === indexes.length) {
    const toConfirmPushed = allHashesToConfirm.map(hash => ({
      pushed: { namespace: SnodeNamespaces.ClosedGroupKeys as const },
      messageHash: hash,
    }));
    multiPartSuccessfulChanges.push(...toConfirmPushed);
  }
  return multiPartSuccessfulChanges;
}

/**
 * This function is run once we get the results from the multiple batch-send for the group push.
 * Note: the logic is the same as `batchResultsToUserSuccessfulChange` but I couldn't make typescript happy.
 */
function batchResultsToGroupSuccessfulChange(
  result: NotEmptyArrayOfBatchResults | null,
  request: GroupDestinationChanges
): Array<GroupSuccessfulChange> {
  const successfulChanges: Array<GroupSuccessfulChange> = [];

  /**
   * For each batch request, we get as result
   * - status code + hash of the new config message
   * - status code of the delete of all messages as given by the request hashes.
   *
   * As it is a sequence, the delete might have failed but the new config message might still be posted.
   * So we need to check which request failed, and if it is the delete by hashes, we need to add the hash of the posted message to the list of hashes
   */
  if (!result?.length) {
    return successfulChanges;
  }

  const flatRequestsDetails: Array<FlattenedDataSentGroupItem> = flatten(
    request.messages.map(m =>
      m.ciphertexts.map(ciphertext => ({ ciphertext, ...omit(m, 'ciphertexts') }))
    )
  );

  const successfulKeysChanges = keysMultiPartDetailsToConfirmPushed(result, flatRequestsDetails);

  const successfulInfosChanges = nonGroupKeysMultiPartDetailsToConfirmPushed({
    flatContentSent: flatRequestsDetails,
    namespace: SnodeNamespaces.ClosedGroupInfo,
    result,
  });

  const successfulMembersChanges = nonGroupKeysMultiPartDetailsToConfirmPushed({
    flatContentSent: flatRequestsDetails,
    namespace: SnodeNamespaces.ClosedGroupMembers,
    result,
  });

  successfulChanges.push(...successfulKeysChanges);
  successfulChanges.push(...successfulInfosChanges);
  successfulChanges.push(...successfulMembersChanges);

  return successfulChanges;
}

/**
 * This function is run once we get the results from the multiple batch-send for the user push.
 * Note: the logic is the same as `batchResultsToGroupSuccessfulChange` but I couldn't make typescript happy.
 */
function batchResultsToUserSuccessfulChange(
  result: NotEmptyArrayOfBatchResults | null,
  request: UserDestinationChanges
): Array<UserSuccessfulChange> {
  const successfulChanges: Array<UserSuccessfulChange> = [];

  /**
   * For each batch request, we get as result
   * - status code + hash of the new config message
   * - status code of the delete of all messages as given by the request hashes.
   *
   * As it is a sequence, the delete might have failed but the new config message might still be posted.
   * So we need to check which request failed, and if it is the delete by hashes, we need to add the hash of the posted message to the list of hashes
   */

  if (!result?.length) {
    return successfulChanges;
  }

  const flatRequestsDetails: Array<FlattenedDataSentUserItem> = flatten(
    request.messages.map(m =>
      m.ciphertexts.map(ciphertext => ({ ciphertext, ...omit(m, 'ciphertexts') }))
    )
  );

  const successfulProfileChanges = userMultiPartDetailsToConfirmPushed({
    flatContentSent: flatRequestsDetails,
    namespace: SnodeNamespaces.UserProfile,
    result,
  });

  const successfulContactsChanges = userMultiPartDetailsToConfirmPushed({
    flatContentSent: flatRequestsDetails,
    namespace: SnodeNamespaces.UserContacts,
    result,
  });

  const successfulUserGroupsChanges = userMultiPartDetailsToConfirmPushed({
    flatContentSent: flatRequestsDetails,
    namespace: SnodeNamespaces.UserGroups,
    result,
  });

  const successfulConvoVolatileChanges = userMultiPartDetailsToConfirmPushed({
    flatContentSent: flatRequestsDetails,
    namespace: SnodeNamespaces.ConvoInfoVolatile,
    result,
  });

  successfulChanges.push(...successfulProfileChanges);
  successfulChanges.push(...successfulContactsChanges);
  successfulChanges.push(...successfulUserGroupsChanges);
  successfulChanges.push(...successfulConvoVolatileChanges);

  return successfulChanges;
}

/**
 * Check if the wrappers related to that pubkeys need to be dumped to the DB, and if yes, do it.
 */
async function saveDumpsToDb(pubkey: PubkeyType | GroupPubkeyType) {
  // first check if this is relating a group
  if (PubKey.is03Pubkey(pubkey)) {
    try {
      const metaNeedsDump = await MetaGroupWrapperActions.needsDump(pubkey);
      // save the concatenated dumps as a single entry in the DB if any of the dumps had a need for dump
      if (metaNeedsDump) {
        window.log.debug(`About to make and save dumps for metagroup ${ed25519Str(pubkey)}`);

        const dump = await MetaGroupWrapperActions.metaDump(pubkey);
        await ConfigDumpData.saveConfigDump({
          data: dump,
          publicKey: pubkey,
          variant: `MetaGroupConfig-${pubkey}`,
        });

        window.log.info(`Saved dumps for metagroup ${ed25519Str(pubkey)}`);
      } else {
        window.log.debug(`No need to update local dumps for metagroup ${ed25519Str(pubkey)}`);
      }
    } catch (e) {
      // The reason we catch exception here is because sometimes we can have a race condition where
      // - we push a change to the group (req1 takes 10s)
      // - while req1 is running, a poll merge results with the group marked as destroyed
      // - this means we have to free the wrapper
      // - then, req finishes, and tries to saveDumpsToDb which fails as the wrapper was freed.
      window.log.warn(
        `saveDumpsToDb for group ${ed25519Str(pubkey)} failed with ${e.message}. This can safely be ignored` // I hope
      );
    }
    return;
  }
  // here, we can only be called with our current user pubkey
  if (pubkey !== UserUtils.getOurPubKeyStrFromCache()) {
    throw new Error('saveDumpsToDb only supports groupv2 and us pubkeys');
  }

  for (let i = 0; i < LibSessionUtil.requiredUserVariants.length; i++) {
    const variant = LibSessionUtil.requiredUserVariants[i];
    const needsDump = await UserGenericWrapperActions.needsDump(variant);

    if (!needsDump) {
      continue;
    }
    const dump = await UserGenericWrapperActions.dump(variant);
    await ConfigDumpData.saveConfigDump({
      data: dump,
      publicKey: pubkey,
      variant,
    });
  }
}

/**
 * Creates the specified member in the specified group wrapper and sets the details provided.
 * Note: no checks are done, so if the member existed already it's name/profile picture are overridden.
 *
 * This should only be used when the current device is explicitly inviting a new member to the group.
 */
async function createMemberAndSetDetails({
  displayName,
  memberPubkey,
  groupPk,
  avatarUrl,
  profileKeyHex,
}: {
  memberPubkey: PubkeyType;
  displayName: string | null;
  groupPk: GroupPubkeyType;
  profileKeyHex: string | null;
  avatarUrl: string | null;
}) {
  await MetaGroupWrapperActions.memberConstructAndSet(groupPk, memberPubkey);

  if (displayName) {
    await MetaGroupWrapperActions.memberSetNameTruncated(groupPk, memberPubkey, displayName);
  }
  if (profileKeyHex && avatarUrl) {
    await MetaGroupWrapperActions.memberSetProfilePicture(groupPk, memberPubkey, {
      url: avatarUrl,
      key: from_hex(profileKeyHex),
    });
  }
}

export const LibSessionUtil = {
  initializeLibSessionUtilWrappers,
  userNamespaceToVariant,
  requiredUserVariants,
  pendingChangesForUs,
  pendingChangesForGroup,
  saveDumpsToDb,
  batchResultsToGroupSuccessfulChange,
  batchResultsToUserSuccessfulChange,
  createMemberAndSetDetails,
};
