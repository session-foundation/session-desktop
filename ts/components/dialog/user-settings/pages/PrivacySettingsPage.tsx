import { useDispatch } from 'react-redux';

import { tr } from '../../../../localization/localeTools';
import {
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
import { SessionButtonColor } from '../../../basic/SessionButton';
import {
  useHasLinkPreviewSetting,
  usePermissionMediaSettings,
  useReadReceiptSetting,
  useTypingIndicatorSetting,
  useWeHaveBlindedMsgRequestsSetting,
} from '../../../../state/selectors/settings';
import { getPasswordHash } from '../../../../util/storage';
import { SpacerXS } from '../../../basic/Text';
import { SettingsToggleBasic } from '../components/SettingsToggleBasic';
import { SettingsPanelButtonInlineBasic } from '../components/SettingsPanelButtonInlineBasic';

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

  const blindedMsgRequestsSetting = useWeHaveBlindedMsgRequestsSetting();
  const linkPreviewSetting = useHasLinkPreviewSetting();
  const typingIndicatorSetting = useTypingIndicatorSetting();
  const readReceiptSetting = useReadReceiptSetting();

  const mediaPermissionSettings = usePermissionMediaSettings();

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
          active={mediaPermissionSettings.callMediaPermissionEnabled}
          onClick={mediaPermissionSettings.toggleCallMediaPermission}
          text={{ token: 'callsVoiceAndVideoBeta' }}
          subText={{ token: 'callsVoiceAndVideoToggleDescription' }}
        />
        <SettingsToggleBasic
          baseDataTestId="enable-microphone"
          active={mediaPermissionSettings.mediaPermissionEnabled}
          onClick={mediaPermissionSettings.toggleMediaPermission}
          text={{ token: 'permissionsMicrophone' }}
          subText={{ token: 'permissionsMicrophoneDescription' }}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'sessionMessageRequests' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="enable-communities-message-requests"
          active={blindedMsgRequestsSetting.enabled}
          onClick={blindedMsgRequestsSetting.toggle}
          text={{ token: 'messageRequestsCommunities' }}
          subText={{ token: 'messageRequestsCommunitiesDescription' }}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'readReceipts' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="enable-read-receipts"
          active={readReceiptSetting.enabled}
          onClick={readReceiptSetting.toggle}
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
          active={typingIndicatorSetting.enabled}
          onClick={typingIndicatorSetting.toggle}
          toggleDataTestId={'enable-typing-indicators-settings-toggle'}
          rowDataTestId={'enable-typing-indicators-settings-row'}
        />{' '}
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'linkPreviews' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="enable-link-previews"
          active={linkPreviewSetting.enabled}
          onClick={linkPreviewSetting.toggle}
          text={{ token: 'linkPreviewsSend' }}
          subText={{ token: 'linkPreviewsDescription' }}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'passwords' }} />
      <PasswordSubSection />
    </SessionWrapperModal>
  );
}
