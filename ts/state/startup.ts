import { ipcRenderer } from 'electron';
import { fromPairs, map, parseInt } from 'lodash';
import { ConvoHub } from '../session/conversations';
import { UserUtils } from '../session/utils';
import { createStore } from './createStore';
import { initialCallState } from './ducks/call';
import { getEmptyConversationState, openConversationWithMessages } from './ducks/conversations';
import { initialDefaultRoomState } from './ducks/defaultRooms';
import { initialModalState } from './ducks/modalDialog';
import { initialOnionPathState } from './ducks/onions';
import { initialPrimaryColorState } from './ducks/primaryColor';
import { initialSearchState } from './ducks/search';
import { initialSectionState } from './ducks/section';
import { getEmptyStagedAttachmentsState } from './ducks/stagedAttachments';
import { StateType } from './reducer';
import { Data } from '../data/data';
import { SettingsKey } from '../data/settings-key';
import { groupInfoActions, initialGroupState } from './ducks/metaGroups';
import { makeUserGroupGetRedux } from './ducks/types/groupReduxTypes';
import { getSettingsInitialState, updateAllOnStorageReady } from './ducks/settings';
import { initialSogsRoomInfoState } from './ducks/sogsRoomInfo';
import { Storage } from '../util/storage';
import { UserGroupsWrapperActions } from '../webworker/workers/browser/libsession_worker_interface';
import { initialReleasedFeaturesState } from './ducks/releasedFeatures';
import { initialDebugState } from './ducks/debug';
import type { UserGroupState } from './ducks/userGroups';
import { initialThemeState } from './theme/ducks/theme';
import { initialNetworkModalState } from './ducks/networkModal';
import { initialNetworkDataState, networkDataActions } from './ducks/networkData';
import { initialProBackendDataState, proBackendDataActions } from './ducks/proBackendData';
import { MessageQueue } from '../session/sending';
import { AvatarMigrate } from '../session/utils/job_runners/jobs/AvatarMigrateJob';
import { handleTriggeredCTAs } from '../components/dialog/SessionCTA';
import { UserSync } from '../session/utils/job_runners/jobs/UserSyncJob';
import { forceSyncConfigurationNowIfNeeded } from '../session/utils/sync/syncUtils';
import { SnodePool } from '../session/apis/snode_api/snodePool';
import { AvatarReupload } from '../session/utils/job_runners/jobs/AvatarReuploadJob';
import { DURATION } from '../session/constants';
import { getSwarmPollingInstance } from '../session/apis/snode_api';
import { getOpenGroupManager } from '../session/apis/open_group_api/opengroupV2/OpenGroupManagerV2';
import { loadDefaultRooms } from '../session/apis/open_group_api/opengroupV2/ApiUtil';
import { getDataFeatureFlag } from './ducks/types/releasedFeaturesReduxTypes';
import { isTestIntegration } from '../shared/env_vars';
import { sleepFor } from '../session/utils/Promise';
import { UpdateProRevocationList } from '../session/utils/job_runners/jobs/UpdateProRevocationListJob';
import { announcementActions, initialAnnouncementState } from './ducks/announcements';
import { NetworkTime } from '../util/NetworkTime';

function makeLookup<T>(items: Array<T>, key: string): { [key: string]: T } {
  // Yep, we can't index into item without knowing what it is. True. But we want to.
  const pairs = map(items, item => [(item as any)[key] as string, item]);

  return fromPairs(pairs);
}

async function createSessionInboxStore() {
  // Here we set up a full redux store with initial state for our LeftPane Root
  const conversations = ConvoHub.use()
    .getConversations()
    .map(conversation => conversation.getConversationModelProps());

  const userGroups: UserGroupState['userGroups'] = {};

  (await UserGroupsWrapperActions.getAllGroups()).forEach(m => {
    userGroups[m.pubkeyHex] = makeUserGroupGetRedux(m);
  });

  const initialState: StateType = {
    conversations: {
      ...getEmptyConversationState(),
      conversationLookup: makeLookup(conversations, 'id'),
    },
    user: {
      ourDisplayNameInProfile: (await UserUtils.getOurProfile()).displayName || '',
      ourNumber: UserUtils.getOurPubKeyStrFromCache(),
      uploadingNewAvatarCurrentUser: false,
      uploadingNewAvatarCurrentUserFailed: false,
    },
    section: initialSectionState,
    defaultRooms: initialDefaultRoomState,
    search: initialSearchState,
    theme: initialThemeState,
    primaryColor: initialPrimaryColorState,
    onionPaths: initialOnionPathState,
    modals: initialModalState,
    stagedAttachments: getEmptyStagedAttachmentsState(),
    call: initialCallState,
    sogsRoomInfo: initialSogsRoomInfoState,
    settings: getSettingsInitialState(),
    groups: initialGroupState,
    userGroups: { userGroups },
    releasedFeatures: initialReleasedFeaturesState,
    debug: initialDebugState,
    networkModal: initialNetworkModalState,
    networkData: initialNetworkDataState,
    proBackendData: initialProBackendDataState,
    announcements: initialAnnouncementState,
  };

  return createStore(initialState);
}

// Do this only if we created a new account id, or if we already received the initial configuration message
const triggerSyncIfNeeded = async () => {
  const us = UserUtils.getOurPubKeyStrFromCache();
  await ConvoHub.use().get(us).setDidApproveMe(true, true);
  await ConvoHub.use().get(us).setIsApproved(true, true);
  const didWeHandleAConfigurationMessageAlready =
    (await Data.getItemById(SettingsKey.hasSyncedInitialConfigurationItem))?.value || false;
  if (didWeHandleAConfigurationMessageAlready) {
    await forceSyncConfigurationNowIfNeeded();
  }
};

async function handleDebNeedsBreakingUpdate() {
  // FIXME this logic can be removed in Session desktop 1.17.8
  const nowMs = process.env.FAKE_NOW ? parseInt(process.env.FAKE_NOW) : NetworkTime.now();
  const firstFebMs = 1769904000000; // 1st february 2026
  window.log.debug('nowMs', nowMs);
  window.log.debug('firstFebMs', firstFebMs);
  if (nowMs < firstFebMs) {
    return;
  }
  const isDebPackaged: boolean = await ipcRenderer.invoke('is-deb-install');
  window.log.debug('isDebPackaged', isDebPackaged);

  if (!isDebPackaged) {
    return;
  }

  window.inboxStore?.dispatch(announcementActions.addDebNeedsBreakingUpdate(true));
}

/**
 * We only need to regenerate the last message of groups/communities once,
 * and we can remove it in a few months safely
 */
async function regenerateLastMessagesGroupsCommunities() {
  if (Storage.getBoolOr(SettingsKey.lastMessageGroupsRegenerated, false)) {
    return; // already regenerated once
  }

  ConvoHub.use()
    .getConversations()
    .filter(m => m.isClosedGroupV2() || m.isOpenGroupV2())
    .forEach(m => {
      m.updateLastMessage();
    });
  await Storage.put(SettingsKey.lastMessageGroupsRegenerated, true);
}

/**
 * This function is called only once: on app startup with a logged in user
 */
export const doAppStartUp = async () => {
  window.openConversationWithMessages = openConversationWithMessages;
  window.inboxStore = await createSessionInboxStore();
  window.getState = window.inboxStore.getState;

  window.inboxStore?.dispatch(
    updateAllOnStorageReady({
      hasBlindedMsgRequestsEnabled: Storage.getBoolOr(
        SettingsKey.hasBlindedMsgRequestsEnabled,
        false
      ),
      settingsLinkPreview: Storage.getBoolOr(SettingsKey.settingsLinkPreview, false),
      hasFollowSystemThemeEnabled: Storage.getBoolOr(
        SettingsKey.hasFollowSystemThemeEnabled,
        false
      ),
      hasShiftSendEnabled: Storage.getBoolOr(SettingsKey.hasShiftSendEnabled, false),
      hideRecoveryPassword: Storage.getBoolOr(SettingsKey.hideRecoveryPassword, false),
      showOnboardingAccountJustCreated: Storage.getBoolOr(
        SettingsKey.showOnboardingAccountJustCreated,
        true
      ),
      audioAutoplay: Storage.getBoolOr(SettingsKey.audioAutoplay, false),
      showRecoveryPhrasePrompt: Storage.getBoolOr(SettingsKey.showRecoveryPhrasePrompt, true),
      hideMessageRequests: Storage.getBoolOr(SettingsKey.hideMessageRequests, false),
    })
  );

  // eslint-disable-next-line more/no-then
  void SnodePool.getFreshSwarmFor(UserUtils.getOurPubKeyStrFromCache()).then(async () => {
    window.log.debug('appStartup: got our fresh swarm, starting polling');
    // trigger any other actions that need to be done after the swarm is ready
    window.inboxStore?.dispatch(networkDataActions.fetchInfoFromSeshServer() as any);
    window.inboxStore?.dispatch(
      proBackendDataActions.refreshGetProDetailsFromProBackend({}) as any
    );
    if (window.inboxStore) {
      const delayedTimeout = getDataFeatureFlag('useLocalDevNet') && isTestIntegration() ? 2000 : 0;
      /**
       * When running on the local dev net (during the regression tests), the network is too fast
       * and we show the DonateCTA before we got the time to grab the recovery phrase.
       * This sleepFor is there to give some time so we can grab the recovery phrase.
       * The regression test this is about is `Donate CTA, DB age >= 7 days`
       */
      // eslint-disable-next-line more/no-then
      void sleepFor(delayedTimeout).then(() => {
        if (window.inboxStore?.dispatch) {
          void handleTriggeredCTAs(window.inboxStore.dispatch, true);
        }
      });
    }
    // we want to (try) to fetch from the revocation server before we process
    // incoming messages, as some might have a pro proof that has been revoked
    await UpdateProRevocationList.runOnStartup();
    void getSwarmPollingInstance().start();
    // trigger a sync message if needed for our other devices
    void triggerSyncIfNeeded();
    void loadDefaultRooms();

    // show the breaking deb update banner if needed
    void handleDebNeedsBreakingUpdate();
  }); // refresh our swarm on start to speed up the first message fetching event

  window.inboxStore?.dispatch(groupInfoActions.loadMetaDumpsFromDB() as any); // this loads the dumps from DB and fills the 03-groups slice with the corresponding details

  // this generates the key to encrypt attachments locally
  await Data.generateAttachmentKeyIfEmpty();

  void Data.cleanupOrphanedAttachments();

  // Note: do not make this a debounce call (as for some reason it doesn't work with promises)
  await AvatarReupload.addAvatarReuploadJob();

  /* Postpone a little bit of the polling of sogs messages to let the swarm messages come in first. */
  global.setTimeout(() => {
    void getOpenGroupManager().startPolling();
  }, 10000);

  global.setTimeout(() => {
    // init the messageQueue. In the constructor, we add all not send messages
    // this call does nothing except calling the constructor, which will continue sending message in the pipeline
    void MessageQueue.use().processAllPending();
  }, 3000);

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  global.setTimeout(async () => {
    // Schedule a confSyncJob in some time to let anything incoming from the network be applied and see if there is a push needed
    // Note: this also starts periodic jobs, so we don't need to keep doing it
    await UserSync.queueNewJobIfNeeded();
  }, 20000);

  global.setTimeout(() => {
    // Schedule all avatarMigrateJobs in some time to let anything incoming from the network be handled first
    void AvatarMigrate.scheduleAllAvatarMigrateJobs();
  }, 1 * DURATION.MINUTES);

  void regenerateLastMessagesGroupsCommunities();
};
