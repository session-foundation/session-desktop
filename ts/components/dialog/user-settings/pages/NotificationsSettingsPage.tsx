import styled from 'styled-components';
import useUpdate from 'react-use/lib/useUpdate';
import { useState } from 'react';

import { tr } from '../../../../localization/localeTools';
import { type UserSettingsModalState } from '../../../../state/ducks/modalDialog';
import {
  PanelButtonGroup,
  PanelButtonTextWithSubText,
  PanelLabelWithDescription,
} from '../../../buttons/PanelButton';
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
import { Notifications } from '../../../../util/notifications';
import { isAudioNotificationSupported } from '../../../../types/Settings';
import { SpacerLG } from '../../../basic/Text';
import { SessionButton, SessionButtonColor } from '../../../basic/SessionButton';
import { PanelRadioButton } from '../../../buttons/PanelRadioButton';

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
      text: tr('notificationsContentShowNameAndContent'),
      subText: tr('notificationSenderNameAndPreview'),
      value: NotificationType.message,
    },
    {
      text: tr('notificationsContentShowNameOnly'),
      subText: tr('notificationSenderNameOnly'),
      value: NotificationType.name,
    },
    {
      text: tr('notificationsContentShowNoNameOrContent'),
      subText: tr('notificationsGenericOnly'),
      value: NotificationType.count,
    },
  ] as const;

  const items = options.map(m => ({
    text: m.text,
    subText: m.subText,
    value: m.value,
  }));

  const onClickPreview = () => {
    if (!notificationsAreEnabled) {
      return;
    }
    Notifications.addPreviewNotification({
      conversationId: `preview-notification-${Date.now()}`,
      message: items.find(m => m.value === initialNotificationEnabled)?.text || 'Message body',
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
              textToken="notificationsSoundDesktop"
              subTextToken="notificationsMakeSound"
            />
          </PanelButtonGroup>
        </>
      )}

      <PanelLabelWithDescription
        title={{ token: 'notificationDisplay' }}
        description={{ token: 'contentNotificationDescription' }}
      />
      <PanelButtonGroup>
        {items.map(({ value, text, subText }) => {
          return (
            <PanelRadioButton
              key={value}
              textElement={
                <PanelButtonTextWithSubText
                  text={text}
                  subText={subText}
                  textDataTestId="disappearing-messages-menu-option"
                  subTextDataTestId="disappearing-messages-timer-menu-option"
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
    <SessionWrapperModal
      headerChildren={
        <ModalBasicHeader
          title={title}
          bigHeader={true}
          extraLeftButton={backAction ? <ModalBackButton onClick={backAction} /> : undefined}
        />
      }
      onClose={closeAction || undefined}
      shouldOverflow={true}
      allowOutsideClick={false}
      $contentMinWidth={WrapperModalWidth.normal}
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
          textToken="enableNotifications"
          subTextToken="notificationsMakeSound"
        />
      </PanelButtonGroup>
      <NotificationsContent
        notificationsAreEnabled={notificationsAreEnabled}
        initialNotificationEnabled={initialNotificationEnabled}
      />
    </SessionWrapperModal>
  );
}
