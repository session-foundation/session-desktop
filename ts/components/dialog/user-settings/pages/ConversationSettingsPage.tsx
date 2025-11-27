import useUpdate from 'react-use/lib/useUpdate';
import { useDispatch, useSelector } from 'react-redux';

import {
  userSettingsModal,
  type UserSettingsModalState,
} from '../../../../state/ducks/modalDialog';
import { PanelButtonGroup, PanelLabelWithDescription } from '../../../buttons/panel/PanelButton';
import { ModalBasicHeader } from '../../../SessionWrapperModal';
import { ModalBackButton } from '../../shared/ModalBackButton';
import {
  useUserSettingsBackAction,
  useUserSettingsCloseAction,
  useUserSettingsTitle,
} from './userSettingsHooks';
import { SettingsKey } from '../../../../data/settings-key';
import { SettingsToggleBasic } from '../components/SettingsToggleBasic';
import { toggleAudioAutoplay } from '../../../../state/ducks/userConfig';

import { getAudioAutoplay } from '../../../../state/selectors/userConfig';
import { SettingsChevronBasic } from '../components/SettingsChevronBasic';
import { useOpengroupPruningSetting } from '../../../../state/selectors/settings';
import { UserSettingsModalContainer } from '../components/UserSettingsModalContainer';

export function ConversationSettingsPage(modalState: UserSettingsModalState) {
  const forceUpdate = useUpdate();
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);
  const title = useUserSettingsTitle(modalState);
  const dispatch = useDispatch();

  const opengroupPruningSetting = useOpengroupPruningSetting();

  const isSpellCheckActive =
    window.getSettingValue(SettingsKey.settingsSpellCheck) === undefined
      ? true
      : window.getSettingValue(SettingsKey.settingsSpellCheck);
  const audioAutoPlay = useSelector(getAudioAutoplay);

  return (
    <UserSettingsModalContainer
      headerChildren={
        <ModalBasicHeader
          title={title}
          bigHeader={true}
          showExitIcon={true}
          extraLeftButton={backAction ? <ModalBackButton onClick={backAction} /> : undefined}
        />
      }
      onClose={closeAction || undefined}
    >
      <PanelLabelWithDescription title={{ token: 'conversationsMessageTrimming' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="conversation-trimming"
          active={opengroupPruningSetting.enabled}
          onClick={opengroupPruningSetting.toggle}
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
    </UserSettingsModalContainer>
  );
}
