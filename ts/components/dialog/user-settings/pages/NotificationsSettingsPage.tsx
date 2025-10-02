import styled from 'styled-components';
import useUpdate from 'react-use/lib/useUpdate';
import { useState } from 'react';

import { tr } from '../../../../localization/localeTools';
import { type UserSettingsModalState } from '../../../../state/ducks/modalDialog';
import {
  PanelButtonGroup,
  PanelButtonTextWithSubText,
  PanelLabelWithDescription,
} from '../../../buttons/panel/PanelButton';
import { ModalBasicHeader } from '../../../SessionWrapperModal';
import { ModalBackButton } from '../../shared/ModalBackButton';
import {
  useUserSettingsBackAction,
  useUserSettingsCloseAction,
  useUserSettingsTitle,
} from './userSettingsHooks';
import { SettingsKey } from '../../../../data/settings-key';
import { SettingsToggleBasic } from '../components/SettingsToggleBasic';
import { Notifications } from '../../../../util/notifications';
import { isAudioNotificationSupported } from '../../../../types/Settings';
import { SpacerLG } from '../../../basic/Text';
import { SessionButton, SessionButtonColor } from '../../../basic/SessionButton';
import { PanelRadioButton } from '../../../buttons/panel/PanelRadioButton';
import { UserSettingsModalContainer } from '../components/UserSettingsModalContainer';

const NotificationType = { message: 'message', name: 'name', count: 'count', off: 'off' } as const;

const StyledButtonContainer = styled.div`
  display: flex;
  width: min-content;
  flex-direction: column;
  padding-inline-start: var(--margins-lg);
`;

function NotificationsContent({
  notificationsAreEnabled,
  initialNotificationEnabled,
}: {
  notificationsAreEnabled: boolean;
  initialNotificationEnabled: (typeof NotificationType)[keyof typeof NotificationType];
}) {
  const forceUpdate = useUpdate();

  const initialAudioNotificationEnabled =
    window.getSettingValue(SettingsKey.settingsAudioNotification) || false;

  const options = [
    {
      text: { token: 'notificationsContentShowNameAndContent' },
      subText: { token: 'notificationSenderNameAndPreview' },
      value: NotificationType.message,
    },
    {
      text: { token: 'notificationsContentShowNameOnly' },
      subText: { token: 'notificationSenderNameOnly' },
      value: NotificationType.name,
    },
    {
      text: { token: 'notificationsContentShowNoNameOrContent' },
      subText: { token: 'notificationsGenericOnly' },
      value: NotificationType.count,
    },
  ] as const;

  const onClickPreview = () => {
    if (!notificationsAreEnabled) {
      return;
    }
    const foundEntry = options.find(m => m.value === initialNotificationEnabled)?.text;
    const message = foundEntry ? tr(foundEntry.token) : 'Message body';

    Notifications.addPreviewNotification({
      conversationId: `preview-notification-${Date.now()}`,
      message,
      title: tr('preview'),
      isExpiringMessage: false,
    });
  };

  const [selected, setSelected] = useState(initialNotificationEnabled);

  if (!notificationsAreEnabled) {
    return null;
  }
  return (
    <>
      {isAudioNotificationSupported() && (
        <>
          <PanelLabelWithDescription title={{ token: 'notificationsSoundDesktop' }} />
          <PanelButtonGroup>
            <SettingsToggleBasic
              baseDataTestId="audio-notifications"
              active={initialAudioNotificationEnabled}
              onClick={async () => {
                await window.setSettingValue(
                  SettingsKey.settingsAudioNotification,
                  !initialAudioNotificationEnabled
                );
                forceUpdate();
              }}
              text={{ token: 'notificationsSoundDesktop' }}
              subText={{ token: 'notificationsMakeSound' }}
            />
          </PanelButtonGroup>
        </>
      )}

      <PanelLabelWithDescription
        title={{ token: 'notificationDisplay' }}
        description={{ token: 'contentNotificationDescription' }}
      />
      <PanelButtonGroup>
        {options.map(({ value, text, subText }) => {
          return (
            <PanelRadioButton
              key={value}
              textElement={
                <PanelButtonTextWithSubText
                  text={text}
                  subText={subText}
                  textDataTestId={`set-notifications-${value}-settings-text`}
                  subTextDataTestId={`set-notifications-${value}-settings-sub-text`}
                />
              }
              value={value}
              isSelected={selected === value}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onSelect={async () => {
                await window.setSettingValue(SettingsKey.settingsNotification, value);
                setSelected(value);
                forceUpdate();
              }}
              rowDataTestId={`set-notifications-${value}-settings-row`}
              radioInputDataTestId={`set-notifications-${value}-settings-radio`}
            />
          );
        })}
      </PanelButtonGroup>
      <StyledButtonContainer>
        <SpacerLG />
        <SessionButton
          text={tr('previewNotification')}
          onClick={onClickPreview}
          buttonColor={SessionButtonColor.PrimaryDark}
        />
      </StyledButtonContainer>
    </>
  );
}

export function NotificationsSettingsPage(modalState: UserSettingsModalState) {
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);
  const title = useUserSettingsTitle(modalState);
  const initialNotificationEnabled =
    window.getSettingValue(SettingsKey.settingsNotification) || NotificationType.message;
  const notificationsAreEnabled =
    initialNotificationEnabled && initialNotificationEnabled !== NotificationType.off;
  const forceUpdate = useUpdate();

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
      <PanelLabelWithDescription title={{ token: 'sessionNotifications' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="notifications"
          active={notificationsAreEnabled}
          onClick={async () => {
            await window.setSettingValue(
              SettingsKey.settingsNotification,
              notificationsAreEnabled ? 'off' : 'message'
            );
            forceUpdate();
          }}
          text={{ token: 'sessionNotifications' }}
          subText={{ token: 'enableNotifications' }}
        />
      </PanelButtonGroup>
      <NotificationsContent
        notificationsAreEnabled={notificationsAreEnabled}
        initialNotificationEnabled={initialNotificationEnabled}
      />
    </UserSettingsModalContainer>
  );
}
