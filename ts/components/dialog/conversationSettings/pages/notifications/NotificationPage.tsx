import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { useIsLegacyGroup, useNotificationSetting } from '../../../../../hooks/useParamSelector';
import { useSelectedConversationKey } from '../../../../../state/selectors/selectedConversation';
import { Flex } from '../../../../basic/Flex';
import { SessionButton } from '../../../../basic/SessionButton';
import { StyledScrollContainer } from '../../../../conversation/right-panel/overlay/components';
import { type ConversationNotificationSettingType } from '../../../../../models/conversationAttributes';
import { localize } from '../../../../../localization/localeTools';
import { PanelButtonGroup } from '../../../../buttons';
import { PanelRadioButton } from '../../../../buttons/PanelRadioButton';
import { updateConversationSettingsModal } from '../../../../../state/ducks/modalDialog';
import { useConversationSettingsModalIsStandalone } from '../../../../../state/selectors/modal';
import { PanelButtonText } from '../../../../buttons/PanelButton';
import { useLocalisedNotificationOptions } from '../../../../menuAndSettingsHooks/useLocalisedNotificationFor';
import { useSetNotificationsFor } from '../../../../menuAndSettingsHooks/useSetNotificationsFor';
import { useShowConversationSettingsFor } from '../../../../menuAndSettingsHooks/useShowConversationSettingsFor';

const ButtonSpacer = styled.div`
  height: 80px;
`;

const StyledButtonContainer = styled.div`
  position: absolute;
  width: 100%;
  bottom: 0px;

  .session-button {
    font-weight: 500;
    min-width: 90px;
    width: fit-content;
    margin: 35px auto 10px;
  }
`;

const getDataTestIdForButton = (
  value: ConversationNotificationSettingType
): React.SessionDataTestId => {
  switch (value) {
    case 'disabled':
      return 'notifications-mute-button';
    case 'mentions_only':
      return 'notifications-mentions-only-button';
    case 'all':
    default:
      return 'notifications-all-messages-button';
  }
};

const getDataTestIdForRadioButton = (
  value: ConversationNotificationSettingType
): React.SessionDataTestId => {
  switch (value) {
    case 'disabled':
      return 'notifications-mute-radio-button';
    case 'mentions_only':
      return 'notifications-mentions-only-radio-button';
    case 'all':
    default:
      return 'notifications-all-messages-radio-button';
  }
};

export const NotificationsPage = () => {
  const dispatch = useDispatch();
  const selectedConversationKey = useSelectedConversationKey();
  const notification = useNotificationSetting(selectedConversationKey);
  const isLegacyGroup = useIsLegacyGroup(selectedConversationKey);

  const [notificationSelected, setNotificationSelected] =
    useState<ConversationNotificationSettingType>(notification);

  const shouldCloseOnSet = useConversationSettingsModalIsStandalone();

  const notificationOptions = useLocalisedNotificationOptions('action');
  const setNotificationFor = useSetNotificationsFor(selectedConversationKey);

  const showConvoSettingsCb = useShowConversationSettingsFor(selectedConversationKey);

  const handleSetNotifications = async () => {
    if (selectedConversationKey && notificationSelected) {
      setNotificationFor(notificationSelected);
      if (shouldCloseOnSet) {
        dispatch(updateConversationSettingsModal(null));
      } else {
        showConvoSettingsCb?.({
          settingsModalPage: 'default',
        });
      }
    }
  };

  if (!notificationSelected) {
    return null;
  }

  if (isLegacyGroup) {
    return null;
  }

  if (!selectedConversationKey) {
    return null;
  }

  const noChanges = notificationSelected === notification;

  return (
    <StyledScrollContainer style={{ position: 'relative' }}>
      <Flex $container={true} $flexDirection={'column'} $alignItems={'center'}>
        <PanelButtonGroup>
          {notificationOptions.map(option => {
            const rowDataTestId = getDataTestIdForButton(option.value);
            const tickDataTestId = getDataTestIdForRadioButton(option.value);

            return (
              <PanelRadioButton
                key={option.value}
                // when we have a radio button, we need to have a text element, but we don't have a text element for notifications
                textElement={
                  <PanelButtonText text={option.name} textDataTestId="invalid-data-testid" />
                }
                value={option}
                isSelected={notificationSelected === option.value}
                onSelect={() => {
                  setNotificationSelected(option.value);
                }}
                rowDataTestId={rowDataTestId}
                radioInputDataTestId={tickDataTestId}
              />
            );
          })}
        </PanelButtonGroup>
        <ButtonSpacer />
        <StyledButtonContainer>
          <SessionButton
            onClick={handleSetNotifications}
            dataTestId={'notifications-set-button'}
            disabled={noChanges}
          >
            {localize('set')}
          </SessionButton>
        </StyledButtonContainer>
      </Flex>
    </StyledScrollContainer>
  );
};
