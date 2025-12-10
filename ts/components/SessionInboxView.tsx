import { fromPairs, map } from 'lodash';

import { Provider } from 'react-redux';
import { persistStore } from 'redux-persist';
import { PersistGate } from 'redux-persist/integration/react';
import styled from 'styled-components';

import { AnimatePresence } from 'framer-motion';
import { LeftPane } from './leftpane/LeftPane';
// moment does not support es-419 correctly (and cause white screen on app start)
import { ConvoHub } from '../session/conversations';
import { UserUtils } from '../session/utils';
import { createStore } from '../state/createStore';
import { initialCallState } from '../state/ducks/call';
import {
  getEmptyConversationState,
  openConversationWithMessages,
} from '../state/ducks/conversations';
import { initialDefaultRoomState } from '../state/ducks/defaultRooms';
import { initialModalState } from '../state/ducks/modalDialog';
import { initialOnionPathState } from '../state/ducks/onions';
import { initialPrimaryColorState } from '../state/ducks/primaryColor';
import { initialSearchState } from '../state/ducks/search';
import { initialSectionState } from '../state/ducks/section';
import { getEmptyStagedAttachmentsState } from '../state/ducks/stagedAttachments';
import { initialUserConfigState } from '../state/ducks/userConfig';
import { StateType } from '../state/reducer';
import { SessionMainPanel } from './SessionMainPanel';

import { Data } from '../data/data';
import { SettingsKey } from '../data/settings-key';
import { groupInfoActions, initialGroupState } from '../state/ducks/metaGroups';
import { makeUserGroupGetRedux } from '../state/ducks/types/groupReduxTypes';
import { getSettingsInitialState, updateAllOnStorageReady } from '../state/ducks/settings';
import { initialSogsRoomInfoState } from '../state/ducks/sogsRoomInfo';
import { SessionTheme } from '../themes/SessionTheme';
import { Storage } from '../util/storage';
import { UserGroupsWrapperActions } from '../webworker/workers/browser/libsession_worker_interface';
import { Flex } from './basic/Flex';
import { initialReleasedFeaturesState } from '../state/ducks/releasedFeatures';
import { initialDebugState } from '../state/ducks/debug';
import type { UserGroupState } from '../state/ducks/userGroups';
import { initialThemeState } from '../state/theme/ducks/theme';
import { initialNetworkModalState } from '../state/ducks/networkModal';
import { initialNetworkDataState, networkDataActions } from '../state/ducks/networkData';
import { initialProBackendDataState, proBackendDataActions } from '../state/ducks/proBackendData';

import { MessageQueue } from '../session/sending';
import { AvatarMigrate } from '../session/utils/job_runners/jobs/AvatarMigrateJob';
import { handleTriggeredProCTAs } from './dialog/SessionCTA';
import { UserSync } from '../session/utils/job_runners/jobs/UserSyncJob';
import { forceSyncConfigurationNowIfNeeded } from '../session/utils/sync/syncUtils';
import { SnodePool } from '../session/apis/snode_api/snodePool';
import { AvatarReupload } from '../session/utils/job_runners/jobs/AvatarReuploadJob';
import { DURATION } from '../session/constants';
import { getSwarmPollingInstance } from '../session/apis/snode_api';
import { getOpenGroupManager } from '../session/apis/open_group_api/opengroupV2/OpenGroupManagerV2';
import { loadDefaultRooms } from '../session/apis/open_group_api/opengroupV2/ApiUtil';
import { sleepFor } from '../session/utils/Promise';
import { getDataFeatureFlag } from '../state/ducks/types/releasedFeaturesReduxTypes';
import { isTestIntegration } from '../shared/env_vars';

function makeLookup<T>(items: Array<T>, key: string): { [key: string]: T } {
  // Yep, we can't index into item without knowing what it is. True. But we want to.
  const pairs = map(items, item => [(item as any)[key] as string, item]);

  return fromPairs(pairs);
}

const StyledGutter = styled.div`
  width: var(--left-panel-width) !important;
  transition: none;
`;

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
    userConfig: initialUserConfigState,
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
    })
  );

  // eslint-disable-next-line more/no-then
  void SnodePool.getFreshSwarmFor(UserUtils.getOurPubKeyStrFromCache()).then(async () => {
    // trigger any other actions that need to be done after the swarm is ready
    window.inboxStore?.dispatch(networkDataActions.fetchInfoFromSeshServer() as any);
    window.inboxStore?.dispatch(
      proBackendDataActions.refreshGetProDetailsFromProBackend({}) as any
    );
    if (window.inboxStore) {
      if (getDataFeatureFlag('useLocalDevNet') && isTestIntegration()) {
        /**
         * When running on the local dev net (during the regression tests), the network is too fast
         * and we show the DonateCTA before we got the time to grab the recovery phrase.
         * This sleepFor is there to give some time so we can grab the recovery phrase.
         * The regression test this is about is `Donate CTA, DB age >= 7 days`
         */
        await sleepFor(1000);
      }
      if (window.inboxStore?.dispatch) {
        void handleTriggeredProCTAs(window.inboxStore.dispatch);
      }
    }
  }); // refresh our swarm on start to speed up the first message fetching event

  window.inboxStore?.dispatch(groupInfoActions.loadMetaDumpsFromDB() as any); // this loads the dumps from DB and fills the 03-groups slice with the corresponding details

  // this generates the key to encrypt attachments locally
  await Data.generateAttachmentKeyIfEmpty();

  // trigger a sync message if needed for our other devices
  void triggerSyncIfNeeded();
  void getSwarmPollingInstance().start();
  void loadDefaultRooms();
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

export const SessionInboxView = () => {
  if (!window.inboxStore) {
    return null;
  }

  const persistor = persistStore(window.inboxStore);
  window.persistStore = persistor;

  return (
    <div className="inbox index">
      <Provider store={window.inboxStore}>
        <PersistGate loading={null} persistor={persistor}>
          <SessionTheme>
            <AnimatePresence>
              <Flex $container={true} height="0" $flexShrink={100} $flexGrow={1}>
                <StyledGutter>
                  <LeftPane />
                </StyledGutter>
                <SessionMainPanel />
              </Flex>
            </AnimatePresence>
          </SessionTheme>
        </PersistGate>
      </Provider>
    </div>
  );
};
