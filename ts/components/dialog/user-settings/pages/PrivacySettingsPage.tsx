import useUpdate from 'react-use/lib/useUpdate';
import { useDispatch } from 'react-redux';

import { tr } from '../../../../localization/localeTools';
import {
  updateConfirmModal,
  userSettingsModal,
  type UserSettingsModalState,
} from '../../../../state/ducks/modalDialog';
import {
  PanelButtonGroup,
  PanelButtonTextWithSubText,
  PanelLabelWithDescription,
} from '../../../buttons/panel/PanelButton';
import { PanelToggleButton } from '../../../buttons/panel/PanelToggleButton';
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
import { CallManager, UserUtils } from '../../../../session/utils';
import { SessionButtonColor } from '../../../basic/SessionButton';
import {
  useHasLinkPreviewEnabled,
  useWeHaveBlindedMsgRequestsEnabled,
} from '../../../../state/selectors/settings';
import { SettingsKey } from '../../../../data/settings-key';
import { SessionUtilUserProfile } from '../../../../session/utils/libsession/libsession_utils_user_profile';
import { getPasswordHash, Storage } from '../../../../util/storage';
import { SpacerXS } from '../../../basic/Text';
import { SettingsToggleBasic } from '../components/SettingsToggleBasic';
import { SettingsPanelButtonInlineBasic } from '../components/SettingsPanelButtonInlineBasic';

const toggleCallMediaPermissions = async (triggerUIUpdate: () => void) => {
  const currentValue = window.getCallMediaPermissions();
  const onClose = () => window.inboxStore?.dispatch(updateConfirmModal(null));
  if (!currentValue) {
    window.inboxStore?.dispatch(
      updateConfirmModal({
        title: tr('callsVoiceAndVideoBeta'),
        i18nMessage: { token: 'callsVoiceAndVideoModalDescription' },
        okTheme: SessionButtonColor.Danger,
        okText: tr('theContinue'),
        onClickOk: async () => {
          await window.toggleCallMediaPermissionsTo(true);
          triggerUIUpdate();
          CallManager.onTurnedOnCallMediaPermissions();
          onClose();
        },
        onClickCancel: async () => {
          await window.toggleCallMediaPermissionsTo(false);
          triggerUIUpdate();
          onClose();
        },
        onClickClose: onClose,
      })
    );
  } else {
    await window.toggleCallMediaPermissionsTo(false);
    triggerUIUpdate();
  }
};

async function toggleLinkPreviews(isToggleOn: boolean, forceUpdate: () => void) {
  if (!isToggleOn) {
    window.inboxStore?.dispatch(
      updateConfirmModal({
        title: tr('linkPreviewsSend'),
        i18nMessage: { token: 'linkPreviewsSendModalDescription' },
        okTheme: SessionButtonColor.Danger,
        okText: tr('theContinue'),
        onClickOk: async () => {
          const newValue = !isToggleOn;
          await window.setSettingValue(SettingsKey.settingsLinkPreview, newValue);
          forceUpdate();
        },
        onClickClose: () => {
          window.inboxStore?.dispatch(updateConfirmModal(null));
        },
      })
    );
  } else {
    await window.setSettingValue(SettingsKey.settingsLinkPreview, false);
    await Storage.put(SettingsKey.hasLinkPreviewPopupBeenDisplayed, false);
    forceUpdate();
  }
}

/**
 * This is a static version of the TypingBubble component, but is only used here, hence why it's not a SessionIcon.
 */
function StaticTypingBubble({ width }: { width: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 30 13" width={width}>
      <rect width="29.07" height="12.87" x=".26" fill="#1B1B1B" rx="6.43" />
      <circle cx="7.88" cy="6.67" r="1.91" fill="#A1A2A1" />
      <circle cx="7.88" cy="6.67" r="1.91" fill="#000" fill-opacity=".5" />
      <circle cx="15.51" cy="6.67" r="1.91" fill="#A1A2A1" />
      <circle cx="15.51" cy="6.67" r="1.91" fill="#000" fill-opacity=".25" />
      <circle cx="23.13" cy="6.67" r="1.91" fill="#A1A2A1" />
    </svg>
  );
}

function HasPasswordSubSection() {
  const dispatch = useDispatch();
  return (
    <PanelButtonGroup>
      <SettingsPanelButtonInlineBasic
        baseDataTestId="change-password"
        text={{ token: 'passwordChange' }}
        subText={{ token: 'passwordChangeShortDescription' }}
        onClick={async () => {
          dispatch(userSettingsModal({ userSettingsPage: 'password', passwordAction: 'change' }));
        }}
        buttonColor={SessionButtonColor.Primary}
        buttonText={tr('change')}
      />
      <SettingsPanelButtonInlineBasic
        baseDataTestId="remove-password"
        text={{ token: 'passwordRemove' }}
        subText={{ token: 'passwordRemoveShortDescription' }}
        onClick={async () => {
          dispatch(userSettingsModal({ userSettingsPage: 'password', passwordAction: 'remove' }));
        }}
        buttonColor={SessionButtonColor.Danger}
        buttonText={tr('remove')}
      />
    </PanelButtonGroup>
  );
}
function NoPasswordSubSection() {
  const dispatch = useDispatch();

  return (
    <PanelButtonGroup>
      <SettingsPanelButtonInlineBasic
        baseDataTestId="set-password"
        text={{ token: 'passwordSet' }}
        subText={{ token: 'passwordSetShortDescription' }}
        onClick={async () => {
          dispatch(userSettingsModal({ userSettingsPage: 'password', passwordAction: 'set' }));
        }}
        buttonColor={SessionButtonColor.Primary}
        buttonText={tr('set')}
      />
    </PanelButtonGroup>
  );
}

function PasswordSubSection() {
  if (getPasswordHash()) {
    return <HasPasswordSubSection />;
  }
  return <NoPasswordSubSection />;
}

export function PrivacySettingsPage(modalState: UserSettingsModalState) {
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);
  const title = useUserSettingsTitle(modalState);
  const weHaveBlindedRequestsEnabled = useWeHaveBlindedMsgRequestsEnabled();
  const isLinkPreviewsOn = useHasLinkPreviewEnabled();

  const forceUpdate = useUpdate();

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
      <PanelLabelWithDescription title={{ token: 'callsSettings' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="enable-calls"
          active={Boolean(window.getCallMediaPermissions())}
          onClick={async () => {
            await toggleCallMediaPermissions(forceUpdate);
            forceUpdate();
          }}
          text={{ token: 'callsVoiceAndVideoBeta' }}
          subText={{ token: 'callsVoiceAndVideoToggleDescription' }}
        />
        <SettingsToggleBasic
          baseDataTestId="enable-microphone"
          active={Boolean(window.getSettingValue('media-permissions'))}
          onClick={async () => {
            await window.toggleMediaPermissions();
            forceUpdate();
          }}
          text={{ token: 'permissionsMicrophone' }}
          subText={{ token: 'permissionsMicrophoneDescription' }}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'sessionMessageRequests' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="enable-communities-message-requests"
          active={weHaveBlindedRequestsEnabled}
          onClick={async () => {
            const toggledValue = !weHaveBlindedRequestsEnabled;
            await window.setSettingValue(SettingsKey.hasBlindedMsgRequestsEnabled, toggledValue);
            await SessionUtilUserProfile.insertUserProfileIntoWrapper(
              UserUtils.getOurPubKeyStrFromCache()
            );
            forceUpdate();
          }}
          text={{ token: 'messageRequestsCommunities' }}
          subText={{ token: 'messageRequestsCommunitiesDescription' }}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'readReceipts' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="enable-read-receipts"
          active={window.getSettingValue(SettingsKey.settingsReadReceipt)}
          onClick={async () => {
            const old = Boolean(window.getSettingValue(SettingsKey.settingsReadReceipt));
            await window.setSettingValue(SettingsKey.settingsReadReceipt, !old);
            forceUpdate();
          }}
          text={{ token: 'readReceipts' }}
          subText={{ token: 'readReceiptsDescription' }}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'typingIndicators' }} />
      <PanelButtonGroup>
        <PanelToggleButton
          textElement={
            <PanelButtonTextWithSubText
              text={{ token: 'typingIndicators' }}
              subText={{ token: 'typingIndicatorsDescription' }}
              textDataTestId={'enable-typing-indicators-settings-text'}
              subTextDataTestId={'enable-typing-indicators-settings-sub-text'}
              extraSubTextNode={
                <>
                  <SpacerXS />
                  <StaticTypingBubble width="30px" />
                </>
              }
            />
          }
          active={Boolean(window.getSettingValue(SettingsKey.settingsTypingIndicator))}
          onClick={async () => {
            const old = Boolean(window.getSettingValue(SettingsKey.settingsTypingIndicator));
            await window.setSettingValue(SettingsKey.settingsTypingIndicator, !old);
            forceUpdate();
          }}
          toggleDataTestId={'enable-typing-indicators-settings-toggle'}
          rowDataTestId={'enable-typing-indicators-settings-row'}
        />{' '}
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'linkPreviews' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="enable-link-previews"
          active={isLinkPreviewsOn}
          onClick={async () => {
            void toggleLinkPreviews(isLinkPreviewsOn, forceUpdate);
          }}
          text={{ token: 'linkPreviewsSend' }}
          subText={{ token: 'linkPreviewsDescription' }}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'passwords' }} />
      <PasswordSubSection />
    </SessionWrapperModal>
  );
}
