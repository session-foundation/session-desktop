import useUpdate from 'react-use/lib/useUpdate';
import { useDispatch, useSelector } from 'react-redux';

import {
  userSettingsModal,
  type UserSettingsModalState,
} from '../../../../state/ducks/modalDialog';
import { PanelButtonGroup, PanelLabelWithDescription } from '../../../buttons/panel/PanelButton';
import {
  ModalBasicHeader,
  SessionWrapperModal,
  WrapperModalWidth,
} from '../../../SessionWrapperModal';
import { ModalBackButton } from '../../shared/ModalBackButton';
import {
  useUserSettingsBackAction,
  useUserSettingsCloseAction,
  useUserSettingsTitle,
} from './userSettingsHooks';
import { SettingsKey } from '../../../../data/settings-key';
import { SettingsToggleBasic } from '../components/SettingsToggleBasic';
import { ToastUtils } from '../../../../session/utils';
import { toggleAudioAutoplay } from '../../../../state/ducks/userConfig';

import { getAudioAutoplay } from '../../../../state/selectors/userConfig';
import { SettingsChevronBasic } from '../components/SettingsChevronBasic';

async function toggleCommunitiesPruning() {
  try {
    const newValue = !(await window.getOpengroupPruning());

    // make sure to write it here too, as this is the value used on the UI to mark the toggle as true/false
    await window.setSettingValue(SettingsKey.settingsOpengroupPruning, newValue);
    await window.setOpengroupPruning(newValue);
    ToastUtils.pushRestartNeeded();
  } catch (e) {
    window.log.warn('toggleCommunitiesPruning change error:', e);
  }
}

export function ConversationSettingsPage(modalState: UserSettingsModalState) {
  const forceUpdate = useUpdate();
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);
  const title = useUserSettingsTitle(modalState);
  const dispatch = useDispatch();

  const isOpengroupPruningEnabled = Boolean(
    window.getSettingValue(SettingsKey.settingsOpengroupPruning)
  );
  const isSpellCheckActive =
    window.getSettingValue(SettingsKey.settingsSpellCheck) === undefined
      ? true
      : window.getSettingValue(SettingsKey.settingsSpellCheck);
  const audioAutoPlay = useSelector(getAudioAutoplay);

  return (
    <SessionWrapperModal
      headerChildren={
        <ModalBasicHeader
          title={title}
          bigHeader={true}
          showExitIcon={true}
          extraLeftButton={backAction ? <ModalBackButton onClick={backAction} /> : undefined}
        />
      }
      onClose={closeAction || undefined}
      shouldOverflow={true}
      allowOutsideClick={false}
      $contentMinWidth={WrapperModalWidth.normal}
    >
      <PanelLabelWithDescription title={{ token: 'conversationsMessageTrimming' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="conversation-trimming"
          active={isOpengroupPruningEnabled}
          onClick={async () => {
            await toggleCommunitiesPruning();
            forceUpdate();
          }}
          text={{ token: 'conversationsMessageTrimmingTrimCommunities' }}
          subText={{ token: 'conversationsMessageTrimmingTrimCommunitiesDescription' }}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'spellChecker' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="spell-check"
          active={isSpellCheckActive}
          onClick={async () => {
            window.toggleSpellCheck();
            forceUpdate();
          }}
          text={{ token: 'conversationsSpellCheck' }}
          subText={{ token: 'conversationsSpellCheckDescription' }}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'conversationsAudioMessages' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="audio-message-autoplay"
          active={audioAutoPlay}
          onClick={async () => {
            dispatch(toggleAudioAutoplay());
            forceUpdate();
          }}
          text={{ token: 'conversationsAutoplayAudioMessage' }}
          subText={{ token: 'conversationsAutoplayAudioMessageDescription' }}
        />
      </PanelButtonGroup>

      <PanelLabelWithDescription title={{ token: 'conversationsBlockedContacts' }} />
      <PanelButtonGroup>
        <SettingsChevronBasic
          baseDataTestId="blocked-contacts"
          onClick={() => {
            dispatch(userSettingsModal({ userSettingsPage: 'blocked-contacts' }));
          }}
          text={{ token: 'conversationsBlockedContacts' }}
          subText={{ token: 'blockedContactsManageDescription' }}
        />
      </PanelButtonGroup>
    </SessionWrapperModal>
  );
}
