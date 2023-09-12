/* eslint-disable no-await-in-loop */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
import { GroupPubkeyType } from 'libsession_util_nodejs';
import { compact, difference, omit } from 'lodash';
import Long from 'long';
import { UserUtils } from '..';
import { ConfigDumpData } from '../../../data/configDump/configDump';
import { HexString } from '../../../node/hexStrings';
import { SignalService } from '../../../protobuf';
import { UserConfigKind } from '../../../types/ProtobufKind';
import { assertUnreachable, toFixedUint8ArrayOfLength } from '../../../types/sqlSharedTypes';
import {
  ConfigWrapperGroupDetailed,
  ConfigWrapperUser,
  getGroupPubkeyFromWrapperType,
  isMetaWrapperType,
  isUserConfigWrapperType,
} from '../../../webworker/workers/browser/libsession_worker_functions';
import {
  GenericWrapperActions,
  MetaGroupWrapperActions,
  UserGroupsWrapperActions,
} from '../../../webworker/workers/browser/libsession_worker_interface';
import { GetNetworkTime } from '../../apis/snode_api/getNetworkTime';
import { SnodeNamespaces } from '../../apis/snode_api/namespaces';
import {
  SharedConfigMessage,
  SharedUserConfigMessage,
} from '../../messages/outgoing/controlMessage/SharedConfigMessage';
import { ed25519Str } from '../../onions/onionPath';
import { PubKey } from '../../types';
import { getUserED25519KeyPairBytes } from '../User';
import { ConfigurationSync } from '../job_runners/jobs/ConfigurationSyncJob';

const requiredUserVariants: Array<ConfigWrapperUser> = [
  'UserConfig',
  'ContactsConfig',
  'UserGroupsConfig',
  'ConvoInfoVolatileConfig',
];

export type OutgoingConfResult<K extends UserConfigKind, T extends SharedConfigMessage<K>> = {
  message: T;
  namespace: SnodeNamespaces;
  oldMessageHashes: Array<string>;
};

async function initializeLibSessionUtilWrappers() {
  const keypair = await UserUtils.getUserED25519KeyPairBytes();
  if (!keypair || !keypair.privKeyBytes) {
    throw new Error('edkeypair not found for current user');
  }
  const privateKeyEd25519 = keypair.privKeyBytes;
  // let's plan a sync on start with some room for the app to be ready
  setTimeout(() => ConfigurationSync.queueNewJobIfNeeded, 20000);

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
    window.log.debug('initializeLibSessionUtilWrappers initing from dump', variant);
    try {
      await GenericWrapperActions.init(
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
    await GenericWrapperActions.init(missingVariant, privateKeyEd25519, null);
    // save the newly created dump to the database even if it is empty, just so we do not need to recreate one next run

    const dump = await GenericWrapperActions.dump(missingVariant);
    await ConfigDumpData.saveConfigDump({
      data: dump,
      publicKey: UserUtils.getOurPubKeyStrFromCache(),
      variant: missingVariant,
    });
    window.log.debug(
      `initializeLibSessionUtilWrappers: missingRequiredVariants "${missingVariant}" created`
    );
  }
  const ed25519KeyPairBytes = await getUserED25519KeyPairBytes();
  if (!ed25519KeyPairBytes?.privKeyBytes) {
    throw new Error('user has no ed25519KeyPairBytes.');
  }
  // TODO then load the Group wrappers (not handled yet) into memory
  // load the dumps retrieved from the database into their corresponding wrappers
  for (let index = 0; index < dumps.length; index++) {
    const dump = dumps[index];
    const { variant } = dump;
    if (!isMetaWrapperType(variant)) {
      continue;
    }
    const groupPk = getGroupPubkeyFromWrapperType(variant);
    const groupPkNoPrefix = groupPk.substring(2);
    const groupEd25519Pubkey = HexString.fromHexString(groupPkNoPrefix);

    try {
      const foundInUserGroups = await UserGroupsWrapperActions.getGroup(groupPk);

      window.log.debug('initializeLibSessionUtilWrappers initing from dump', variant);
      // TODO we need to fetch the admin key here if we have it, maybe from the usergroup wrapper?
      await MetaGroupWrapperActions.init(groupPk, {
        groupEd25519Pubkey: toFixedUint8ArrayOfLength(groupEd25519Pubkey, 32),
        groupEd25519Secretkey: foundInUserGroups?.secretKey || null,
        userEd25519Secretkey: toFixedUint8ArrayOfLength(ed25519KeyPairBytes.privKeyBytes, 64),
        metaDumped: dump.data,
      });
    } catch (e) {
      // TODO should not throw in this case? we should probably just try to load what we manage to load
      window.log.warn(`initGroup of Group wrapper of variant ${variant} failed with ${e.message} `);
      // throw new Error(`initializeLibSessionUtilWrappers failed with ${e.message}`);
    }
  }
}

async function pendingChangesForUs(): Promise<
  Array<OutgoingConfResult<UserConfigKind, SharedUserConfigMessage>>
> {
  const us = UserUtils.getOurPubKeyStrFromCache();

  const dumps = await ConfigDumpData.getAllDumpsWithoutDataFor(us);

  // Ensure we always check the required user config types for changes even if there is no dump
  // data yet (to deal with first launch cases)
  LibSessionUtil.requiredUserVariants.forEach(requiredVariant => {
    if (!dumps.find(m => m.publicKey === us && m.variant === requiredVariant)) {
      dumps.push({
        publicKey: us,
        variant: requiredVariant,
      });
    }
  });

  const results: Array<OutgoingConfResult<UserConfigKind, SharedUserConfigMessage>> = [];
  const variantsNeedingPush = new Set<ConfigWrapperUser>();

  for (let index = 0; index < dumps.length; index++) {
    const dump = dumps[index];
    const variant = dump.variant;
    if (!isUserConfigWrapperType(variant)) {
      // this shouldn't happen for our pubkey.
      continue;
    }
    const needsPush = await GenericWrapperActions.needsPush(variant);

    if (!needsPush) {
      continue;
    }

    variantsNeedingPush.add(variant);
    const { data, seqno, hashes, namespace } = await GenericWrapperActions.push(variant);

    const kind = userVariantToUserKind(variant);

    results.push({
      message: new SharedUserConfigMessage({
        data,
        kind,
        seqno: Long.fromNumber(seqno),
        timestamp: GetNetworkTime.getNowWithNetworkOffset(),
      }),
      oldMessageHashes: hashes,
      namespace,
    });
  }
  window.log.info(`those variants needs push: "${[...variantsNeedingPush]}"`);

  return results;
}

type PendingChangesForGroupShared = {
  data: Uint8Array;
  seqno: Long;
  timestamp: number;
  namespace: SnodeNamespaces;
};

type PendingChangesForGroupNonKey = PendingChangesForGroupShared & {
  type: Extract<ConfigWrapperGroupDetailed, 'GroupInfo' | 'GroupMember'>;
};

type PendingChangesForGroupKey = Pick<
  PendingChangesForGroupShared,
  'data' | 'namespace' | 'timestamp'
> & { type: Extract<ConfigWrapperGroupDetailed, 'GroupKeys'> };

export type PendingChangesForGroup = PendingChangesForGroupNonKey | PendingChangesForGroupKey;

export type GroupSingleDestinationChanges = {
  messages: Array<PendingChangesForGroup>;
  allOldHashes: Set<string>;
};

async function pendingChangesForGroup(
  groupPk: GroupPubkeyType
): Promise<GroupSingleDestinationChanges> {
  const results = new Array<PendingChangesForGroup>();
  if (!PubKey.isClosedGroupV3(groupPk)) {
    throw new Error(`pendingChangesForGroup only works for user or 03 group pubkeys`);
  }
  // one of the wrapper behind the metagroup needs a push
  const needsPush = await MetaGroupWrapperActions.needsPush(groupPk);

  // we probably need to add the GROUP_KEYS check here

  if (!needsPush) {
    return { messages: results, allOldHashes: new Set() };
  }

  const { groupInfo, groupMember, groupKeys } = await MetaGroupWrapperActions.push(groupPk);
  debugger;

  // Note: We need the keys to be pushed first to avoid a race condition
  if (groupKeys) {
    results.push({
      type: 'GroupKeys',
      data: groupKeys.data,
      namespace: groupKeys.namespace,
      timestamp: GetNetworkTime.getNowWithNetworkOffset(),
    });
  }

  if (groupInfo) {
    results.push({
      type: 'GroupInfo',
      data: groupInfo.data,
      seqno: Long.fromNumber(groupInfo.seqno),
      timestamp: GetNetworkTime.getNowWithNetworkOffset(),
      namespace: groupInfo.namespace,
    });
  }
  if (groupMember) {
    results.push({
      type: 'GroupMember',
      data: groupMember.data,
      seqno: Long.fromNumber(groupMember.seqno),
      timestamp: GetNetworkTime.getNowWithNetworkOffset(),
      namespace: groupMember.namespace,
    });
  }
  window.log.debug(
    `${ed25519Str(groupPk)} those group variants needs push: "${results.map(m => m.type)}"`
  );

  const memberHashes = compact(groupMember?.hashes) || [];
  const infoHashes = compact(groupInfo?.hashes) || [];
  const allOldHashes = new Set([...infoHashes, ...memberHashes]);

  console.error('compactedHashes', [...allOldHashes]);
  return { messages: results, allOldHashes };
}

function userKindToVariant(kind: UserConfigKind): ConfigWrapperUser {
  switch (kind) {
    case SignalService.SharedConfigMessage.Kind.USER_PROFILE:
      return 'UserConfig';
    case SignalService.SharedConfigMessage.Kind.CONTACTS:
      return 'ContactsConfig';
    case SignalService.SharedConfigMessage.Kind.USER_GROUPS:
      return 'UserGroupsConfig';
    case SignalService.SharedConfigMessage.Kind.CONVO_INFO_VOLATILE:
      return 'ConvoInfoVolatileConfig';
    default:
      assertUnreachable(kind, `userKindToVariant: Unsupported variant: "${kind}"`);
  }
}

function userVariantToUserKind(variant: ConfigWrapperUser) {
  switch (variant) {
    case 'UserConfig':
      return SignalService.SharedConfigMessage.Kind.USER_PROFILE;
    case 'ContactsConfig':
      return SignalService.SharedConfigMessage.Kind.CONTACTS;
    case 'UserGroupsConfig':
      return SignalService.SharedConfigMessage.Kind.USER_GROUPS;
    case 'ConvoInfoVolatileConfig':
      return SignalService.SharedConfigMessage.Kind.CONVO_INFO_VOLATILE;
    default:
      assertUnreachable(variant, `userVariantToKind: Unsupported kind: "${variant}"`);
  }
}

/**
 * Returns true if the config needs to be dumped afterwards
 */
async function markAsPushed(variant: ConfigWrapperUser, seqno: number, hash: string) {
  await GenericWrapperActions.confirmPushed(variant, seqno, hash);
  return GenericWrapperActions.needsDump(variant);
}

export const LibSessionUtil = {
  initializeLibSessionUtilWrappers,
  userVariantToUserKind,
  requiredUserVariants,
  pendingChangesForUs,
  pendingChangesForGroup,
  userKindToVariant,
  markAsPushed,
};