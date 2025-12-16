/* eslint-disable no-await-in-loop */
/* eslint-disable more/no-then */
/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  GroupPubkeyType,
  type WithDecodedEnvelope,
  type WithMessageHash,
} from 'libsession_util_nodejs';
import { z } from 'zod';

import { compact, concat, flatten, isArray, isEmpty, last, omit, sampleSize, uniqBy } from 'lodash';
import { v4 } from 'uuid';
import { Data } from '../../../data/data';
import * as Receiver from '../../../receiver/receiver';
import { PubKey } from '../../types';

import { ConversationModel } from '../../../models/conversation';
import { LibsessionMessageHandler } from '../../../receiver/libsession/handleLibSessionMessage';
import { SwarmDecodedEnvelope } from '../../../receiver/types';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import {
  UserGenericWrapperActions,
  MetaGroupWrapperActions,
  UserGroupsWrapperActions,
  MultiEncryptWrapperActions,
} from '../../../webworker/workers/browser/libsession_worker_interface';
import { DURATION, SWARM_POLLING_TIMEOUT } from '../../constants';
import { ConvoHub } from '../../conversations';
import { getSodiumRenderer } from '../../crypto';
import { StringUtils, UserUtils } from '../../utils';
import { sleepFor } from '../../utils/Promise';
import { ed25519Str, fromBase64ToArray, fromHexToArray } from '../../utils/String';
import { NotFoundError } from '../../utils/errors';
import { LibSessionUtil } from '../../utils/libsession/libsession_utils';
import { MultiEncryptUtils } from '../../utils/libsession/libsession_utils_multi_encrypt';
import { SnodeNamespace, SnodeNamespaces, SnodeNamespacesUserConfig } from './namespaces';
import { PollForGroup, PollForLegacy, PollForUs } from './pollingTypes';
import { SnodeAPIRetrieve } from './retrieveRequest';
import { SnodePool } from './snodePool';
import { SwarmPollingGroupConfig } from './swarm_polling_config/SwarmPollingGroupConfig';
import { SwarmPollingUserConfig } from './swarm_polling_config/SwarmPollingUserConfig';
import {
  RetrieveMessageItem,
  RetrieveMessageItemWithNamespace,
  RetrieveMessagesResultsBatched,
  type RetrieveMessagesResultsMergedBatched,
} from './types';
import { ConversationTypeEnum } from '../../../models/types';
import { Snode } from '../../../data/types';
import ProBackendAPI from '../pro_backend_api/ProBackendAPI';
import { NetworkTime } from '../../../util/NetworkTime';
import { getFeatureFlag } from '../../../state/ducks/types/releasedFeaturesReduxTypes';
import { setIsOnlineIfDifferent } from '../../utils/InsecureNodeFetch';
import {
  getCachedUserConfig,
  UserConfigWrapperActions,
} from '../../../webworker/workers/browser/libsession/libsession_worker_userconfig_interface';

const minMsgCountShouldRetry = 95;
/**
 * We retrieve from multiple snodes at the same time, and merge their reported messages because it's easy
 * for a snode to be out of sync.
 * Sometimes, being out of sync means that we won't be able to retrieve a message at all (revoked_subaccount).
 * We need a proper fix server side, but in the meantime, that's all we can do.
 */
const RETRIEVE_SNODES_COUNT = 2;

let instance: SwarmPolling | undefined;
const timeouts: Array<NodeJS.Timeout> = [];

export const getSwarmPollingInstance = () => {
  if (!instance) {
    instance = new SwarmPolling();
  }
  return instance;
};

type GroupPollingEntry = {
  pubkey: PubKey;
  lastPolledTimestamp: number;
  callbackFirstPoll?: () => Promise<void>;
};

function entryToKey(entry: GroupPollingEntry) {
  return entry.pubkey.key;
}

function mergeMultipleRetrieveResults(
  results: RetrieveMessagesResultsBatched
): RetrieveMessagesResultsMergedBatched {
  const mapped: Map<SnodeNamespaces, Map<string, RetrieveMessageItem>> = new Map();
  for (let resultIndex = 0; resultIndex < results.length; resultIndex++) {
    const result = results[resultIndex];
    if (!mapped.has(result.namespace)) {
      mapped.set(result.namespace, new Map());
    }
    if (result.messages.messages) {
      for (let msgIndex = 0; msgIndex < result.messages.messages.length; msgIndex++) {
        const msg = result.messages.messages[msgIndex];
        if (!mapped.get(result.namespace)!.has(msg.hash)) {
          mapped.get(result.namespace)!.set(msg.hash, msg);
        }
      }
    }
  }

  // Convert the merged map back to an array
  return Array.from(mapped.entries()).map(([namespace, messagesMap]) => ({
    code: results.find(m => m.namespace === namespace)?.code || 200,
    namespace,
    messages: { messages: Array.from(messagesMap.values()) },
  }));
}

function swarmLog(msg: string) {
  if (getFeatureFlag('debugSwarmPolling')) {
    window.log.info(msg);
  }
}

export class SwarmPolling {
  private groupPolling: Array<GroupPollingEntry>;

  /**
   * lastHashes[snode_edkey][pubkey_polled][namespace_polled] = last_hash
   */
  private readonly lastHashes: Record<string, Record<string, Record<number, string>>>;
  private hasStarted = false;

  constructor() {
    this.groupPolling = [];
    this.lastHashes = {};
  }

  public async start(waitForFirstPoll = false): Promise<void> {
    // when restoring from seed we have to start polling before we get on the mainPage, hence this check here to make sure we do not start twice
    if (this.hasStarted) {
      return;
    }
    this.hasStarted = true;
    this.loadGroupIds();
    if (waitForFirstPoll) {
      await this.pollForAllKeys();
    } else {
      timeouts.push(
        setTimeout(() => {
          void this.pollForAllKeys();
        }, 4000)
      );
    }
  }

  /**
   * Used for testing only
   */
  public resetSwarmPolling() {
    this.groupPolling = [];
    this.hasStarted = false;
  }

  public stop(e?: Error) {
    window.log.warn('SwarmPolling: stopped swarm polling', e?.message || e || '');

    for (let i = 0; i < timeouts.length; i++) {
      clearTimeout(timeouts[i]);
    }
    this.resetSwarmPolling();
  }

  public forcePolledTimestamp(pubkey: string, lastPoll: number) {
    const foundAt = this.groupPolling.findIndex(group => {
      return PubKey.isEqual(pubkey, group.pubkey);
    });

    if (foundAt > -1) {
      this.groupPolling[foundAt].lastPolledTimestamp = lastPoll;
    }
  }

  public addGroupId(pubkey: PubKey | string, callbackFirstPoll?: () => Promise<void>) {
    const pk = PubKey.cast(pubkey);
    if (PubKey.is05Pubkey(pk.key)) {
      window.log.info('not polling for legacy group');
      return;
    }
    if (this.groupPolling.findIndex(m => m.pubkey.key === pk.key) === -1) {
      window?.log?.info(
        `SwarmPolling: Swarm addGroupId: adding pubkey ${ed25519Str(pk.key)} to polling`
      );
      this.groupPolling.push({ pubkey: pk, lastPolledTimestamp: 0, callbackFirstPoll });
    } else if (callbackFirstPoll) {
      // group is already polled. Hopefully we already have keys for it to decrypt messages?
      void sleepFor(2000).then(() => {
        void callbackFirstPoll();
      });
    }
  }

  public removePubkey(pk: PubKey | string, reason: string) {
    const pubkey = PubKey.cast(pk);
    if (this.groupPolling.some(group => pubkey.key === group.pubkey.key)) {
      window?.log?.info(`SwarmPolling: removing ${ed25519Str(pubkey.key)} for reason: "${reason}"`);
      this.groupPolling = this.groupPolling.filter(group => !pubkey.isEqual(group.pubkey));
    }
  }

  /**
   * Only public for testing purpose.
   *
   * Currently, a group with an
   *  -> an activeAt less than 2 days old is considered active and polled often (every 5 sec)
   *  -> an activeAt less than 1 week old is considered medium_active and polled a bit less (every minute)
   *  -> an activeAt more than a week old is considered inactive, and not polled much (every 2 minutes)
   */
  public getPollingTimeout(convoId: PubKey) {
    const convo = ConvoHub.use().get(convoId.key);
    if (!convo) {
      return SWARM_POLLING_TIMEOUT.INACTIVE;
    }
    const activeAt = convo.getActiveAt();
    if (!activeAt) {
      return SWARM_POLLING_TIMEOUT.INACTIVE;
    }

    const currentTimestamp = Date.now();
    const diff = currentTimestamp - activeAt;

    // consider that this is an active group if activeAt is less than two days old
    if (diff <= DURATION.DAYS * 2) {
      return SWARM_POLLING_TIMEOUT.ACTIVE;
    }

    if (diff <= DURATION.DAYS * 7) {
      return SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE;
    }
    return SWARM_POLLING_TIMEOUT.INACTIVE;
  }

  public shouldPollByTimeout(entry: GroupPollingEntry) {
    const convoPollingTimeout = this.getPollingTimeout(entry.pubkey);
    const diff = Date.now() - entry.lastPolledTimestamp;
    return diff >= convoPollingTimeout;
  }

  public async getPollingDetails(pollingEntries: Array<GroupPollingEntry>) {
    // Note: all of those checks are explicitly made only based on the libsession wrappers data, and NOT the DB.
    // Eventually, we want to get rid of the duplication between the DB and libsession wrappers.
    // If you need to add a check based on the DB, this is code smell.
    let toPollDetails: Array<PollForUs | PollForLegacy | PollForGroup> = [];
    const ourPubkey = UserUtils.getOurPubKeyStrFromCache();

    if (pollingEntries.some(m => m.pubkey.key === ourPubkey)) {
      throw new Error(
        'pollingEntries should only contain group swarm (legacy or not), but not ourself'
      );
    }

    // First, make sure we do poll for our own swarm. Note: we always poll as often as possible for our swarm
    toPollDetails.push([ourPubkey, ConversationTypeEnum.PRIVATE]);

    const allGroupsLegacyInWrapper = await UserGroupsWrapperActions.getAllLegacyGroups();
    const allGroupsInWrapper = await UserGroupsWrapperActions.getAllGroups();
    if (!isArray(allGroupsLegacyInWrapper) || !isArray(allGroupsInWrapper)) {
      throw new Error('getAllLegacyGroups or getAllGroups returned unknown result');
    }

    // only groups NOT starting with 03
    const legacyGroups = pollingEntries.filter(m => !PubKey.is03Pubkey(m.pubkey.key));

    // only groups starting with 03
    const groups = pollingEntries.filter(m => PubKey.is03Pubkey(m.pubkey.key));

    // let's grab the groups and legacy groups which should be left as they are not in their corresponding wrapper
    const legacyGroupsToLeave = legacyGroups
      .filter(m => !allGroupsLegacyInWrapper.some(w => w.pubkeyHex === m.pubkey.key))
      .map(entryToKey);
    const groupsToLeave = groups
      .filter(m => !allGroupsInWrapper.some(w => w.pubkeyHex === m.pubkey.key))
      .map(entryToKey);

    const allGroupsTracked = groups
      .filter(m => this.shouldPollByTimeout(m)) // should we poll from it depending on this group activity?
      .filter(m => {
        // We don't poll from groups which are not in the user group wrapper, and for those which are not marked as accepted
        // We don't want to leave them, we just don't want to poll from them.
        const found = allGroupsInWrapper.find(w => w.pubkeyHex === m.pubkey.key);
        return found && !found.invitePending;
      })
      .map(m => m.pubkey.key as GroupPubkeyType) // extract the pubkey
      .map(m => [m, ConversationTypeEnum.GROUPV2] as PollForGroup);

    toPollDetails = concat(toPollDetails, allGroupsTracked);

    return { toPollDetails, legacyGroupsToLeave, groupsToLeave };
  }

  /**
   * Only public for testing
   */
  public async pollForAllKeys() {
    if (!window.isOnline) {
      window?.log?.error('SwarmPolling: pollForAllKeys: offline');
      // Very important to set up a new polling call so we do retry at some point
      setIsOnlineIfDifferent(false);
      timeouts.push(setTimeout(this.pollForAllKeys.bind(this), SWARM_POLLING_TIMEOUT.ACTIVE));
      return;
    }

    const { toPollDetails, groupsToLeave, legacyGroupsToLeave } = await this.getPollingDetails(
      this.groupPolling
    );
    // first, leave anything which shouldn't be there anymore
    await Promise.all(
      concat(groupsToLeave, legacyGroupsToLeave).map(m =>
        this.notPollingForGroupAsNotInWrapper(m, 'not in wrapper before poll')
      )
    );

    try {
      await Promise.all(toPollDetails.map(toPoll => this.pollOnceForKey(toPoll)));
    } catch (e) {
      window?.log?.warn('SwarmPolling: pollForAllKeys exception: ', e);
      throw e;
    } finally {
      timeouts.push(setTimeout(this.pollForAllKeys.bind(this), SWARM_POLLING_TIMEOUT.ACTIVE));
    }
  }

  public async updateLastPollTimestampForPubkey({
    countMessages,
    pubkey,
    type,
  }: {
    type: ConversationTypeEnum;
    countMessages: number;
    pubkey: string;
  }) {
    // if all snodes returned an error (null), no need to update the lastPolledTimestamp
    if (type === ConversationTypeEnum.GROUP || type === ConversationTypeEnum.GROUPV2) {
      window?.log?.debug(
        `SwarmPolling: Polled for group${ed25519Str(pubkey)} got ${countMessages} messages back.`
      );
      let lastPolledTimestamp = Date.now();
      if (countMessages >= minMsgCountShouldRetry) {
        // if we get `minMsgCountShouldRetry` messages or more back, it means there are probably more than this
        // so make sure to retry the polling in the next 5sec by marking the last polled timestamp way before that it is really
        // this is a kind of hack
        lastPolledTimestamp = Date.now() - SWARM_POLLING_TIMEOUT.INACTIVE - 5 * 1000;
      } // update the last fetched timestamp

      this.forcePolledTimestamp(pubkey, lastPolledTimestamp);
    }
  }

  public async handleUserOrGroupConfMessages({
    confMessages,
    pubkey,
    type,
  }: {
    type: ConversationTypeEnum;
    pubkey: string;
    confMessages: Array<RetrieveMessageItemWithNamespace> | null;
  }) {
    if (!confMessages) {
      return;
    }

    // first make sure to handle the shared user config message first
    if (type === ConversationTypeEnum.PRIVATE && UserUtils.isUsFromCache(pubkey)) {
      // this does not throw, no matter what happens
      await SwarmPollingUserConfig.handleUserSharedConfigMessages(confMessages);
      return;
    }
    if (type === ConversationTypeEnum.GROUPV2 && PubKey.is03Pubkey(pubkey)) {
      await sleepFor(100);
      await SwarmPollingGroupConfig.handleGroupSharedConfigMessages(confMessages, pubkey);
    }
  }

  public async handleRevokedMessages({
    revokedMessages,
    groupPk,
    type,
  }: {
    type: ConversationTypeEnum;
    groupPk: string;
    revokedMessages: Array<RetrieveMessageItemWithNamespace> | null;
  }) {
    if (!revokedMessages || isEmpty(revokedMessages)) {
      return;
    }
    const sodium = await getSodiumRenderer();
    const userEd25519SecretKey = (await UserUtils.getUserED25519KeyPairBytes()).privKeyBytes;
    const ourPk = UserUtils.getOurPubKeyStrFromCache();
    const senderEd25519Pubkey = fromHexToArray(groupPk.slice(2));

    if (type === ConversationTypeEnum.GROUPV2 && PubKey.is03Pubkey(groupPk)) {
      for (let index = 0; index < revokedMessages.length; index++) {
        const revokedMessage = revokedMessages[index];
        const successWith = await MultiEncryptUtils.multiDecryptAnyEncryptionDomain({
          encoded: fromBase64ToArray(revokedMessage.data),
          userEd25519SecretKey,
          senderEd25519Pubkey,
        });
        if (successWith && successWith.decrypted && !isEmpty(successWith.decrypted)) {
          try {
            await LibsessionMessageHandler.handleLibSessionMessage({
              decrypted: successWith.decrypted,
              domain: successWith.domain,
              groupPk,
              ourPk,
              sodium,
            });
          } catch (e) {
            window.log.warn('SwarmPolling: handleLibSessionMessage failed with:', e.message);
          }
        }
      }
    }
  }

  /**
   * Only exposed as public for testing
   */
  public async pollOnceForKey([pubkey, type]: PollForUs | PollForLegacy | PollForGroup) {
    const namespaces = this.getNamespacesToPollFrom(type);
    const swarmSnodes = await SnodePool.getSwarmFor(pubkey);
    let resultsFromAllNamespaces: RetrieveMessagesResultsMergedBatched | null;

    let toPollFrom: Array<Snode> = [];

    try {
      toPollFrom = sampleSize(swarmSnodes, RETRIEVE_SNODES_COUNT);

      if (toPollFrom.length !== RETRIEVE_SNODES_COUNT) {
        throw new Error(
          `SwarmPolling: pollOnceForKey: not snodes in swarm for ${ed25519Str(pubkey)}. Expected to have at least ${RETRIEVE_SNODES_COUNT}.`
        );
      }

      const resultsFromAllSnodesSettled = await Promise.allSettled(
        toPollFrom.map(async snode => {
          swarmLog(
            `SwarmPolling: about to pollNodeForKey of ${ed25519Str(pubkey)} from snode: ${ed25519Str(snode.pubkey_ed25519)} namespaces: ${namespaces} `
          );

          const thisSnodeResults = await this.pollNodeForKey(snode, pubkey, namespaces, type);

          swarmLog(
            `SwarmPolling: pollNodeForKey of ${ed25519Str(pubkey)} from snode: ${ed25519Str(snode.pubkey_ed25519)} namespaces: ${namespaces} returned: ${thisSnodeResults?.length}`
          );

          return thisSnodeResults;
        })
      );

      swarmLog(
        `SwarmPolling: pollNodeForKey of ${ed25519Str(pubkey)} namespaces: ${namespaces} returned ${resultsFromAllSnodesSettled.filter(m => m.status === 'fulfilled').length}/${RETRIEVE_SNODES_COUNT} fulfilled promises`
      );

      resultsFromAllNamespaces = mergeMultipleRetrieveResults(
        compact(
          resultsFromAllSnodesSettled.filter(m => m.status === 'fulfilled').flatMap(m => m.value)
        )
      );
    } catch (e) {
      window.log.warn(
        `SwarmPolling: pollNodeForKey of ${pubkey} namespaces: ${namespaces} failed with: ${e.message}`
      );
      resultsFromAllNamespaces = null;
    }

    if (!resultsFromAllNamespaces?.length) {
      // Not a single message from any of the polled namespace was retrieved.
      // We must still mark the current pubkey as "was just polled"
      await this.updateLastPollTimestampForPubkey({
        countMessages: 0,
        pubkey,
        type,
      });
      return;
    }
    const { confMessages, otherMessages, revokedMessages } = filterMessagesPerTypeOfConvo(
      type,
      resultsFromAllNamespaces
    );
    window.log.debug(
      `SwarmPolling: received for ${ed25519Str(pubkey)} confMessages:${confMessages?.length || 0}, revokedMessages:${revokedMessages?.length || 0}, , otherMessages:${otherMessages?.length || 0}, `
    );
    // We always handle the config messages first (for groups 03 or our own messages)
    await this.handleUserOrGroupConfMessages({ confMessages, pubkey, type });

    await this.handleRevokedMessages({ revokedMessages, groupPk: pubkey, type });

    // Merge results into one list of unique messages
    const uniqOtherMsgs = uniqBy(otherMessages, x => x.hash);
    if (uniqOtherMsgs.length) {
      window.log.debug(
        `SwarmPolling: received uniqOtherMsgs: ${uniqOtherMsgs.length} for type: ${type}`
      );
    }
    await this.updateLastPollTimestampForPubkey({
      countMessages: uniqOtherMsgs.length,
      pubkey,
      type,
    });

    const shouldDiscardMessages = await this.shouldLeaveNotPolledGroup({ type, pubkey });
    if (shouldDiscardMessages) {
      swarmLog(
        `SwarmPolling: polled a pk which should not be polled anymore: ${ed25519Str(
          pubkey
        )}. Discarding polling result`
      );
      return;
    }

    const newMessages = await this.handleSeenMessages(uniqOtherMsgs);
    swarmLog(
      `SwarmPolling: handleSeenMessages: ${newMessages.length} out of ${uniqOtherMsgs.length} are not seen yet about pk:${ed25519Str(pubkey)} snode: ${JSON.stringify(toPollFrom.map(m => ed25519Str(m.pubkey_ed25519)))}`
    );

    if (type === ConversationTypeEnum.GROUPV2) {
      if (!PubKey.is03Pubkey(pubkey)) {
        throw new Error('groupv2 expects a 03 key');
      }
      const groupEncKeys = await MetaGroupWrapperActions.keyGetAll(pubkey);
      if (!groupEncKeys.length) {
        swarmLog(`No groupEncKeys for group: ${ed25519Str(pubkey)} yet. Skipping`);
      } else {
        const decryptedMessages = await MultiEncryptWrapperActions.decryptForGroup(
          newMessages.map(m => ({
            envelopePayload: fromBase64ToArray(m.data),
            messageHash: m.hash,
          })),
          {
            proBackendPubkeyHex: ProBackendAPI.getServer().server.edPkHex,
            ed25519GroupPubkeyHex: pubkey,
            groupEncKeys,
          }
        );

        await handleDecryptedMessagesForSwarm(newMessages, decryptedMessages, pubkey);
      }
      // if a callback was registered for the first poll of that group pk, call it
      const groupEntry = this.groupPolling.find(m => m.pubkey.key === pubkey);
      if (groupEntry && groupEntry.callbackFirstPoll) {
        void groupEntry.callbackFirstPoll();
        groupEntry.callbackFirstPoll = undefined;
      }

      return;
    }
    if (type !== ConversationTypeEnum.PRIVATE) {
      // - groups v2 messages are handled above,
      // - legacy groups are disabled
      // - and communities messages are handled somewhere else
      // So here, we should only have 1o1 messages
      throw new Error('handleSeenMessages: only private convos are supported here');
    }
    const ed25519PrivateKeyHex = (await UserUtils.getUserED25519KeyPair()).privKey.slice(0, 64);

    const decryptedMessages = await MultiEncryptWrapperActions.decryptFor1o1(
      newMessages.map(m => ({
        envelopePayload: fromBase64ToArray(m.data),
        messageHash: m.hash,
      })),
      {
        proBackendPubkeyHex: ProBackendAPI.getServer().server.edPkHex,
        ed25519PrivateKeyHex,
      }
    );

    await handleDecryptedMessagesForSwarm(newMessages, decryptedMessages, null);
  }

  private async shouldLeaveNotPolledGroup({
    pubkey,
    type,
  }: {
    type: ConversationTypeEnum;
    pubkey: string;
  }) {
    const correctlyTypedPk = PubKey.is03Pubkey(pubkey) || PubKey.is05Pubkey(pubkey) ? pubkey : null;
    if (!correctlyTypedPk) {
      return false;
    }
    const allLegacyGroupsInWrapper = await UserGroupsWrapperActions.getAllLegacyGroups();
    const allGroupsInWrapper = await UserGroupsWrapperActions.getAllGroups();

    // don't handle incoming messages from group when the group is not tracked.
    // this can happen when a group is removed from the wrapper while we were polling

    const newGroupButNotInWrapper =
      PubKey.is03Pubkey(correctlyTypedPk) &&
      !allGroupsInWrapper.some(m => m.pubkeyHex === correctlyTypedPk);
    const legacyGroupButNoInWrapper =
      type === ConversationTypeEnum.GROUP &&
      PubKey.is05Pubkey(correctlyTypedPk) &&
      !allLegacyGroupsInWrapper.some(m => m.pubkeyHex === pubkey);

    if (newGroupButNotInWrapper || legacyGroupButNoInWrapper) {
      // not tracked anymore in the wrapper. Discard messages and stop polling
      await this.notPollingForGroupAsNotInWrapper(correctlyTypedPk, 'not in wrapper after poll');
      return true;
    }
    return false;
  }

  private async getHashesToBump(
    type: ConversationTypeEnum,
    pubkey: string
  ): Promise<Array<string>> {
    if (type === ConversationTypeEnum.PRIVATE) {
      const configHashesToBump: Array<string> = [];
      for (let index = 0; index < LibSessionUtil.requiredUserVariants.length; index++) {
        const variant = LibSessionUtil.requiredUserVariants[index];
        try {
          const toBump = await UserGenericWrapperActions.activeHashes(variant);

          if (toBump?.length) {
            configHashesToBump.push(...toBump);
          }
        } catch (e) {
          window.log.warn(`SwarmPolling: failed to get activeHashes for user variant ${variant}`);
        }
      }
      window.log.debug(
        `SwarmPolling: configHashesToBump private count: ${configHashesToBump.length}`
      );
      return configHashesToBump;
    }
    if (type === ConversationTypeEnum.GROUPV2 && PubKey.is03Pubkey(pubkey)) {
      const toBump = await MetaGroupWrapperActions.activeHashes(pubkey);
      window.log.debug(
        `SwarmPolling: configHashesToBump group(${ed25519Str(pubkey)}) count: ${toBump.length}`
      );
      return toBump;
    }
    return [];
  }

  // Fetches messages for `pubkey` from `node` potentially updating
  // the lash hash record
  private async pollNodeForKey(
    node: Snode,
    pubkey: string,
    namespaces: Array<SnodeNamespaces>,
    type: ConversationTypeEnum
  ): Promise<RetrieveMessagesResultsBatched | null> {
    const namespaceLength = namespaces.length;
    if (namespaceLength <= 0) {
      throw new Error(
        `SwarmPolling: invalid number of retrieve namespace provided: ${namespaceLength}`
      );
    }
    const snodeEdkey = node.pubkey_ed25519;

    try {
      const configHashesToBump = await this.getHashesToBump(type, pubkey);
      const namespacesAndLastHashes = await Promise.all(
        namespaces.map(async namespace => {
          const lastHash = await this.getLastHash(snodeEdkey, pubkey, namespace);
          return { namespace, lastHash };
        })
      );
      window.log.debug(
        `namespacesAndLastHashes for ${ed25519Str(pubkey)}:`,
        JSON.stringify(namespacesAndLastHashes)
      );

      const allow401s = type === ConversationTypeEnum.GROUPV2;
      const results = await SnodeAPIRetrieve.retrieveNextMessagesNoRetries(
        node,
        pubkey,
        namespacesAndLastHashes,
        UserUtils.getOurPubKeyStrFromCache(),
        configHashesToBump,
        allow401s
      );

      const namespacesAndLastHashesAfterFetch = await Promise.all(
        namespaces.map(async namespace => {
          const lastHash = await this.getLastHash(snodeEdkey, pubkey, namespace);
          return { namespace, lastHash };
        })
      );

      if (
        namespacesAndLastHashes.some(m => m) &&
        namespacesAndLastHashesAfterFetch.every(m => !m)
      ) {
        swarmLog(
          `SwarmPolling: hashes for ${ed25519Str(pubkey)} have been reset while we were fetching new messages. discarding them....`
        );
        return [];
      }

      const noConfigBeforeFetch = namespacesAndLastHashes
        .filter(m => SnodeNamespace.isGroupConfigNamespace(m.namespace))
        .every(m => !m.lastHash);

      const noConfigAfterFetch = results
        .filter(m => SnodeNamespace.isGroupConfigNamespace(m.namespace))
        .every(m => !m.messages.messages?.length);
      const convo = ConvoHub.use().get(pubkey);

      if (PubKey.is03Pubkey(pubkey) && convo) {
        if (noConfigBeforeFetch && noConfigAfterFetch) {
          // Well, here we are again putting bandaids to deal with our flaky backend.
          // Sometimes (often I'd say), a snode is out of sync with its swarm but still replies with what he thinks is the swarm's content.
          // So, here we've fetched from a snode that has no lastHash, and after the fetch we still have no lastHash.
          // A normally constituted human would understand this as "there is nothing on that swarm for that pubkey".
          // Well, sometimes we just hit one of those out-of-sync snode and it is telling us the swarm is empty, when for every other snode of the swarm, it is not.
          // This isn't usually too bad, because usually not having a fetch result just means we will fetch the another snode next time.
          // But sometimes we have destructive actions or here, show a banner.
          // Ideally, we'd fix this on the backend, but until then I am writing one more bandaid here.
          // The bandaid is checking if we've already fetched from any other snode a last hash for the keys namespace.
          // If yes, we know that the snode we just polled from reports incorrectly that the swarm to be empty.
          const swarmSnodes = await SnodePool.getSwarmFor(pubkey);
          let foundAtLeastAHashInSwarm = false;
          let swarmIndex = 0;
          do {
            const lastHash = await this.getLastHash(
              swarmSnodes[swarmIndex].pubkey_ed25519,
              pubkey,
              SnodeNamespaces.ClosedGroupKeys
            );
            if (lastHash) {
              foundAtLeastAHashInSwarm = true;
              break; // breaking so the swarmIndex is correct here
            }
            swarmIndex++;
          } while (swarmIndex < swarmSnodes.length);

          if (foundAtLeastAHashInSwarm) {
            // considering that group as not expired
            window.log.info(
              `no configs before and after fetch of group: ${ed25519Str(pubkey)} from snode ${ed25519Str(snodeEdkey)}, but another snode has config hash fetched already (${ed25519Str(swarmSnodes?.[swarmIndex]?.pubkey_ed25519)}). Group is not expired.`
            );
          } else {
            // the group appears to be expired.
            window.log.warn(
              `no configs before and after fetch of group: ${ed25519Str(pubkey)} from snode ${ed25519Str(snodeEdkey)}, and no other snode have one either. Group is expired.`
            );
            if (!convo.getIsExpired03Group()) {
              convo.setIsExpired03Group(true);
              await convo.commit();
            }
          }
        } else if (convo.getIsExpired03Group()) {
          window.log.info(
            `configs received for group marked as expired: ${ed25519Str(pubkey)}... Marking it unexpired`
          );

          // Group was marked as "expired", but apparently it is not (we have hashes saved/just fetched).
          // Maybe an admin came back online?, anyway mark the group as not expired.
          convo.setIsExpired03Group(false);
          await convo.commit();
        }
      }
      if (!results.length) {
        return [];
      }
      const lastMessages = results.map(r => {
        return last(r.messages.messages);
      });
      const namespacesWithNewLastHashes = namespacesAndLastHashes.map((n, i) => {
        const newHash = lastMessages[i]?.hash || '<none>';
        const role = SnodeNamespace.toRole(n.namespace);
        return `${role}:${newHash}`;
      });

      swarmLog(
        `SwarmPolling: updating last hashes for ${ed25519Str(pubkey)}: ${ed25519Str(snodeEdkey)}  ${namespacesWithNewLastHashes.join(', ')}`
      );
      await Promise.all(
        lastMessages.map(async (lastMessage, index) => {
          if (!lastMessage) {
            return;
          }
          await this.updateLastHash({
            edkey: snodeEdkey,
            pubkey,
            namespace: namespaces[index],
            hash: lastMessage.hash,
            expiration: lastMessage.expiration,
          });
        })
      );

      return results;
    } catch (e) {
      window?.log?.warn('SwarmPolling: pollNodeForKey failed with:', e.message);
      return null;
    }
  }

  private async notPollingForGroupAsNotInWrapper(pubkey: string, reason: string) {
    if (!PubKey.is03Pubkey(pubkey) && !PubKey.is05Pubkey(pubkey)) {
      return;
    }
    window.log.debug(
      `SwarmPolling: notPollingForGroupAsNotInWrapper ${ed25519Str(pubkey)} with reason:"${reason}"`
    );
    if (PubKey.is05Pubkey(pubkey)) {
      await ConvoHub.use().deleteLegacyGroup(pubkey, {
        fromSyncMessage: true,
        sendLeaveMessage: false,
      });
    } else if (PubKey.is03Pubkey(pubkey)) {
      await ConvoHub.use().deleteGroup(pubkey, {
        fromSyncMessage: true,
        sendLeaveMessage: false,
        deletionType: 'doNotKeep',
        deleteAllMessagesOnSwarm: false,
        forceDestroyForAllMembers: false,
        clearFetchedHashes: true,
      });
    }
  }

  private loadGroupIds() {
    const convos = ConvoHub.use().getConversations();

    const closedGroupsOnly = convos.filter(
      (c: ConversationModel) =>
        (c.isClosedGroupV2() && !c.isBlocked() && !c.isKickedFromGroup() && c.isApproved()) ||
        (c.isClosedGroup() && !c.isBlocked() && !c.isKickedFromGroup())
    );

    closedGroupsOnly.forEach(c => {
      this.addGroupId(new PubKey(c.id));
    });
  }

  private async handleSeenMessages(
    messages: Array<RetrieveMessageItemWithNamespace>
  ): Promise<Array<RetrieveMessageItemWithNamespace>> {
    if (!messages.length) {
      return [];
    }

    const incomingHashes = messages.map((m: RetrieveMessageItemWithNamespace) => m.hash);
    const dupHashes = await Data.getSeenMessagesByHashList(incomingHashes);
    const newMessages = messages.filter(
      (m: RetrieveMessageItemWithNamespace) => !dupHashes.includes(m.hash)
    );

    return newMessages;
  }

  // eslint-disable-next-line consistent-return
  public getNamespacesToPollFrom(type: ConversationTypeEnum) {
    if (type === ConversationTypeEnum.PRIVATE) {
      const toRet: Array<SnodeNamespacesUserConfig | SnodeNamespaces.Default> = [
        SnodeNamespaces.Default,
        SnodeNamespaces.UserProfile,
        SnodeNamespaces.UserContacts,
        SnodeNamespaces.UserGroups,
        SnodeNamespaces.ConvoInfoVolatile,
      ];
      return toRet;
    }
    if (type === ConversationTypeEnum.GROUPV2) {
      return [
        SnodeNamespaces.ClosedGroupRevokedRetrievableMessages, // if we are kicked from the group, this will still return a 200, other namespaces will be 401/403
        SnodeNamespaces.ClosedGroupMessages,
        SnodeNamespaces.ClosedGroupInfo,
        SnodeNamespaces.ClosedGroupMembers,
        SnodeNamespaces.ClosedGroupKeys, // keys are fetched last to avoid race conditions when someone deposits them
      ];
    }
    if (type === ConversationTypeEnum.GROUP) {
      throw new Error('legacy groups are readonly'); // legacy groups are readonly
    }
    assertUnreachable(
      type,
      `getNamespacesToPollFrom case should have been unreachable: type:${type}`
    );
  }

  private async updateLastHash({
    edkey,
    expiration,
    hash,
    namespace,
    pubkey,
  }: {
    edkey: string;
    pubkey: string;
    namespace: number;
    hash: string;
    expiration: number;
  }): Promise<void> {
    const cached = await this.getLastHash(edkey, pubkey, namespace);

    if (!cached || cached !== hash) {
      await Data.updateLastHash({
        convoId: pubkey,
        snode: edkey,
        hash,
        expiresAt: expiration,
        namespace,
      });
    }

    if (!this.lastHashes[edkey]) {
      this.lastHashes[edkey] = {};
    }
    if (!this.lastHashes[edkey][pubkey]) {
      this.lastHashes[edkey][pubkey] = {};
    }
    this.lastHashes[edkey][pubkey][namespace] = hash;
  }

  private async getLastHash(nodeEdKey: string, pubkey: string, namespace: number): Promise<string> {
    if (!this.lastHashes[nodeEdKey]?.[pubkey]?.[namespace]) {
      const lastHash = await Data.getLastHashBySnode(pubkey, nodeEdKey, namespace);

      if (!this.lastHashes[nodeEdKey]) {
        this.lastHashes[nodeEdKey] = {};
      }

      if (!this.lastHashes[nodeEdKey][pubkey]) {
        this.lastHashes[nodeEdKey][pubkey] = {};
      }
      this.lastHashes[nodeEdKey][pubkey][namespace] = lastHash || '';
    }
    // return the cached value/the one set on the line above
    return this.lastHashes[nodeEdKey][pubkey][namespace];
  }

  public async resetLastHashesForConversation(conversationId: string) {
    await Data.clearLastHashesForConvoId(conversationId);
    const snodeKeys = Object.keys(this.lastHashes);
    for (let index = 0; index < snodeKeys.length; index++) {
      const snodeKey = snodeKeys[index];
      if (!isEmpty(this.lastHashes[snodeKey][conversationId])) {
        this.lastHashes[snodeKey][conversationId] = {};
      }
    }
  }

  public async pollOnceForOurDisplayName(abortSignal?: AbortSignal): Promise<string> {
    if (abortSignal?.aborted) {
      throw new NotFoundError('[pollOnceForOurDisplayName] aborted right away');
    }

    const pubkey = UserUtils.getOurPubKeyFromCache();

    const swarmSnodes = await SnodePool.getSwarmFor(pubkey.key);

    if (!swarmSnodes.length) {
      throw new Error(
        `[pollOnceForOurDisplayName] no snode in swarm for ${ed25519Str(pubkey.key)}`
      );
    }

    if (abortSignal?.aborted) {
      throw new NotFoundError(
        '[pollOnceForOurDisplayName] aborted after selecting nodes to poll from'
      );
    }

    const firstResultWithMessagesUserProfile = await Promise.any(
      swarmSnodes.map(async toPollFrom => {
        // Note: always print something so we know if the polling is hanging
        window.log.info(
          `[onboarding] about to pollOnceForOurDisplayName of ${ed25519Str(pubkey.key)} from snode: ${ed25519Str(toPollFrom.pubkey_ed25519)} namespaces: ${[SnodeNamespaces.UserProfile]} `
        );
        const retrieved = await SnodeAPIRetrieve.retrieveNextMessagesNoRetries(
          toPollFrom,
          pubkey.key,
          [{ lastHash: '', namespace: SnodeNamespaces.UserProfile }],
          pubkey.key,
          null,
          false
        );

        // Note: always print something so we know if the polling is hanging
        window.log.info(
          `[onboarding] pollOnceForOurDisplayName of ${ed25519Str(pubkey.key)} from snode: ${ed25519Str(toPollFrom.pubkey_ed25519)} namespaces: ${[SnodeNamespaces.UserProfile]} returned: ${retrieved?.length}`
        );
        if (!retrieved?.length) {
          /**
           * Sometimes, a snode is out of sync with its swarm but still replies with what he thinks is the swarm's content.
           * When that happens, we can get a "no display name" error, as indeed, that snode didn't have a config message on user profile.
           * To fix this, we've added a check over all of the snodes of our swarm, and we pick the first one that reports having a config message on user profile.
           * This won't take care of the case where a snode has a message with an empty display name, but it's not the root issue that this was added for.
           */

          throw new Error(
            `pollOnceForOurDisplayName of ${ed25519Str(pubkey.key)} from snode: ${ed25519Str(toPollFrom.pubkey_ed25519)}  no results from user profile`
          );
        }
        return retrieved;
      })
    );

    // check if we just fetched the details from the config namespaces.
    // If yes, merge them together and exclude them from the rest of the messages.
    if (!firstResultWithMessagesUserProfile?.length) {
      throw new NotFoundError('[pollOnceForOurDisplayName] resultsFromUserProfile is empty');
    }

    if (abortSignal?.aborted) {
      throw new NotFoundError(
        '[pollOnceForOurDisplayName] aborted after retrieving user profile config messages'
      );
    }

    const userConfigMessagesWithNamespace: Array<Array<RetrieveMessageItemWithNamespace>> =
      firstResultWithMessagesUserProfile.map(r => {
        return (r.messages.messages || []).map(m => {
          return { ...m, namespace: SnodeNamespaces.UserProfile };
        });
      });

    const userConfigMessagesMerged = flatten(compact(userConfigMessagesWithNamespace));
    if (!userConfigMessagesMerged.length) {
      throw new NotFoundError(
        '[pollOnceForOurDisplayName] after merging there are no user config messages'
      );
    }
    let displayNameFound: string | undefined;
    try {
      const keypair = await UserUtils.getUserED25519KeyPairBytes();
      if (!keypair || !keypair.privKeyBytes) {
        throw new Error('edkeypair not found for current user');
      }

      const privateKeyEd25519 = keypair.privKeyBytes;

      // we take the latest config message to create the wrapper in memory
      const incomingConfigMessages = userConfigMessagesMerged.map(m => ({
        data: StringUtils.fromBase64ToArray(m.data),
        hash: m.hash,
      }));

      await UserConfigWrapperActions.init(privateKeyEd25519, null);
      await UserConfigWrapperActions.merge(incomingConfigMessages);

      const foundName = getCachedUserConfig().name;
      if (!foundName) {
        throw new Error('UserInfo not found or name is empty');
      }
      displayNameFound = foundName;
    } catch (e) {
      window.log.warn('LibSessionUtil.initializeLibSessionUtilWrappers failed with', e.message);
    } finally {
      await UserConfigWrapperActions.free();
    }

    if (!displayNameFound || isEmpty(displayNameFound)) {
      throw new NotFoundError(
        '[pollOnceForOurDisplayName] Got a config message from network but without a displayName...'
      );
    }

    return displayNameFound;
  }
}

// zod schema for retrieve items as returned by the snodes
const retrieveItemSchema = z.object({
  hash: z.string(),
  data: z.string(),
  expiration: z.number().finite(),
  timestamp: z.number().finite().positive(),
});

function retrieveItemWithNamespace(
  results: RetrieveMessagesResultsMergedBatched
): Array<RetrieveMessageItemWithNamespace> {
  return flatten(
    compact(
      results.map(result =>
        result.messages.messages?.map(r => {
          // throws if the result is not expected
          const parsedItem = retrieveItemSchema.parse(r);
          return {
            ...omit(parsedItem, 'timestamp'),
            namespace: result.namespace,
            storedAt: parsedItem.timestamp,
          };
        })
      )
    )
  );
}

function filterMessagesPerTypeOfConvo<T extends ConversationTypeEnum>(
  type: T,
  retrieveResults: RetrieveMessagesResultsMergedBatched
): {
  confMessages: Array<RetrieveMessageItemWithNamespace> | null;
  revokedMessages: Array<RetrieveMessageItemWithNamespace> | null;
  otherMessages: Array<RetrieveMessageItemWithNamespace>;
} {
  switch (type) {
    case ConversationTypeEnum.PRIVATE: {
      const userConfs = retrieveResults.filter(m =>
        SnodeNamespace.isUserConfigNamespace(m.namespace)
      );
      const userOthers = retrieveResults.filter(
        m => !SnodeNamespace.isUserConfigNamespace(m.namespace)
      );

      const confMessages = retrieveItemWithNamespace(userConfs);
      const otherMessages = retrieveItemWithNamespace(userOthers);

      return {
        confMessages,
        revokedMessages: null,
        otherMessages: uniqBy(otherMessages, x => x.hash),
      };
    }

    case ConversationTypeEnum.GROUP:
      return {
        confMessages: null,
        otherMessages: retrieveItemWithNamespace(retrieveResults),
        revokedMessages: null,
      };

    case ConversationTypeEnum.GROUPV2: {
      const groupConfs = retrieveResults.filter(m =>
        SnodeNamespace.isGroupConfigNamespace(m.namespace)
      );
      const groupRevoked = retrieveResults.filter(
        m => m.namespace === SnodeNamespaces.ClosedGroupRevokedRetrievableMessages
      );
      const groupOthers = retrieveResults.filter(
        m =>
          !SnodeNamespace.isGroupConfigNamespace(m.namespace) &&
          m.namespace !== SnodeNamespaces.ClosedGroupRevokedRetrievableMessages
      );

      const groupConfMessages = retrieveItemWithNamespace(groupConfs);
      const groupOtherMessages = retrieveItemWithNamespace(groupOthers);
      const revokedMessages = retrieveItemWithNamespace(groupRevoked);

      return {
        confMessages: groupConfMessages,
        otherMessages: uniqBy(groupOtherMessages, x => x.hash),
        revokedMessages,
      };
    }

    default:
      return { confMessages: null, otherMessages: [], revokedMessages: null };
  }
}

async function handleDecryptedMessagesForSwarm(
  newMessages: Array<Pick<RetrieveMessageItem, 'hash' | 'expiration'>>,
  decryptedMessages: Array<WithDecodedEnvelope & WithMessageHash>,
  // only set the  groupPk if this is an incoming group message
  groupPk: GroupPubkeyType | null
) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  for (let index = 0; index < newMessages.length; index++) {
    const msg = newMessages[index];

    const foundDecrypted = decryptedMessages.find(m => m.messageHash === msg.hash);

    try {
      if (!foundDecrypted || !foundDecrypted.decodedEnvelope?.contentPlaintextUnpadded?.length) {
        // we failed to decrypt that message, mark it as seen and move on
        continue;
      }

      const decodedEnvelope = new SwarmDecodedEnvelope({
        id: v4(),
        source: groupPk ?? foundDecrypted.decodedEnvelope.sessionId,
        senderIdentity: groupPk ? foundDecrypted.decodedEnvelope.sessionId : '', // none for 1o1 messages
        contentDecrypted: foundDecrypted.decodedEnvelope.contentPlaintextUnpadded,
        receivedAtMs: NetworkTime.now(),
        messageHash: msg.hash,
        sentAtMs: foundDecrypted.decodedEnvelope.envelope.timestampMs,
        messageExpirationFromRetrieve: msg.expiration,
        decodedPro: foundDecrypted.decodedEnvelope.decodedPro,
      });

      // this is the processing of the message itself, which can be long.
      // We allow 1 minute per message at most, which should be plenty
      await Receiver.handleSwarmContentDecryptedWithTimeout({
        decodedEnvelope,
      });
    } catch (e) {
      window.log.warn(
        `SwarmPolling: failed to handle ${ed25519Str(groupPk ?? us)} otherMessage because of: `,
        e.message
      );
    } finally {
      // that message was processed (even if we failed to process it) so we
      // can add it to the seen messages list so we don't reprocess it later.
      try {
        await Data.saveSeenMessageHashes([
          {
            hash: msg.hash,
            expiresAt: msg.expiration,
            // 1o1 messages received are always received from our swarm
            conversationId: groupPk ?? us,
          },
        ]);
      } catch (e) {
        window.log.warn('SwarmPolling: failed saveSeenMessageHashes: ', e.message);
      }
    }
  }
}
