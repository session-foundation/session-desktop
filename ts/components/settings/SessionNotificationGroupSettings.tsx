/* eslint-disable @typescript-eslint/no-misused-promises */

import useUpdate from 'react-use/lib/useUpdate';
import styled from 'styled-components';
import { SettingsKey } from '../../data/settings-key';
import { isAudioNotificationSupported } from '../../types/Settings';
import { Notifications } from '../../util/notifications';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import { SessionRadioGroup, SessionRadioItems } from '../basic/SessionRadioGroup';
import { SpacerLG } from '../basic/Text';
import { SessionSettingsItemWrapper, SessionToggleWithDescription } from './SessionSettingListItem';
import { tr } from '../../localization/localeTools';

const NotificationType = { message: 'message', name: 'name', count: 'count', off: 'off' } as const;

const StyledButtonContainer = styled.div`
  display: flex;
  width: min-content;
  flex-direction: column;
  padding-inline-start: var(--margins-lg);
`;

export const SessionNotificationGroupSettings = () => {
  const forceUpdate = useUpdate();

  const initialNotificationEnabled =
    window.getSettingValue(SettingsKey.settingsNotification) || NotificationType.message;

  const initialAudioNotificationEnabled =
    window.getSettingValue(SettingsKey.settingsAudioNotification) || false;

  const notificationsAreEnabled =
    initialNotificationEnabled && initialNotificationEnabled !== NotificationType.off;

  const options = [
    {
      label: tr('notificationsContentShowNameAndContent'),
      value: NotificationType.message,
    },
    { label: tr('notificationsContentShowNameOnly'), value: NotificationType.name },
    {
      label: tr('notificationsContentShowNoNameOrContent'),
      value: NotificationType.count,
    },
  ] as const;

  const items: SessionRadioItems = options.map(m => ({
    label: m.label,
    value: m.value,
    inputDataTestId: `input-${m.value}`,
    labelDataTestId: `label-${m.value}`,
  }));

  const onClickPreview = () => {
    if (!notificationsAreEnabled) {
      return;
    }
    Notifications.addPreviewNotification({
      conversationId: `preview-notification-${Date.now()}`,
      message: items.find(m => m.value === initialNotificationEnabled)?.label || 'Message body',
      title: tr('preview'),
      isExpiringMessage: false,
    });
  };

  return (
    <>
      <SessionToggleWithDescription
        onClickToggle={async () => {
          await window.setSettingValue(
            SettingsKey.settingsNotification,
            notificationsAreEnabled ? 'off' : 'message'
          );
          forceUpdate();
        }}
        title={tr('sessionNotifications')}
        active={notificationsAreEnabled}
      />
      {notificationsAreEnabled && isAudioNotificationSupported() && (
        <SessionToggleWithDescription
          onClickToggle={async () => {
            await window.setSettingValue(
              SettingsKey.settingsAudioNotification,
              !initialAudioNotificationEnabled
            );
            forceUpdate();
          }}
          title={tr('notificationsSoundDesktop')}
          active={initialAudioNotificationEnabled}
        />
      )}
      {notificationsAreEnabled ? (
        <SessionSettingsItemWrapper
          title={tr('notificationsContent')}
          description={tr('notificationsContentDescription')}
          inline={false}
        >
          <SessionRadioGroup
            initialItem={initialNotificationEnabled}
            group={SettingsKey.settingsNotification}
            items={items}
            onClick={async (selectedRadioValue: string) => {
              await window.setSettingValue(SettingsKey.settingsNotification, selectedRadioValue);
              forceUpdate();
            }}
            style={{ maxWidth: '400px' }}
          />
          <StyledButtonContainer>
            <SpacerLG />
            <SessionButton
              text={tr('preview')}
              onClick={onClickPreview}
              buttonColor={SessionButtonColor.PrimaryDark}
            />
          </StyledButtonContainer>
        </SessionSettingsItemWrapper>
      ) : null}
    </>
  );
};
