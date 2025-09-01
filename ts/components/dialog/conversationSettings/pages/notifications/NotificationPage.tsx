import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useIsLegacyGroup, useNotificationSetting } from '../../../../../hooks/useParamSelector';
import { useSelectedConversationKey } from '../../../../../state/selectors/selectedConversation';
import { Flex } from '../../../../basic/Flex';
import { SessionButton, SessionButtonType } from '../../../../basic/SessionButton';
import { StyledScrollContainer } from '../../../../conversation/right-panel/overlay/components';
import { type ConversationNotificationSettingType } from '../../../../../models/conversationAttributes';
import { PanelButtonGroup } from '../../../../buttons';
import { PanelRadioButton } from '../../../../buttons/panel/PanelRadioButton';
import {
  updateConversationSettingsModal,
  type ConversationSettingsModalState,
} from '../../../../../state/ducks/modalDialog';
import { useConversationSettingsModalIsStandalone } from '../../../../../state/selectors/modal';
import { PanelButtonText } from '../../../../buttons/panel/PanelButton';
import { useLocalisedNotificationOptions } from '../../../../menuAndSettingsHooks/useLocalisedNotificationFor';
import { useSetNotificationsFor } from '../../../../menuAndSettingsHooks/useSetNotificationsFor';
import { useShowConversationSettingsFor } from '../../../../menuAndSettingsHooks/useShowConversationSettingsFor';
import {
  useBackActionForPage,
  useCloseActionFromPage,
  useTitleFromPage,
} from '../conversationSettingsHooks';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
  WrapperModalWidth,
} from '../../../../SessionWrapperModal';
import { ModalBackButton } from '../../../shared/ModalBackButton';
import { SpacerMD } from '../../../../basic/Text';
import { tr } from '../../../../../localization/localeTools';

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

export function NotificationForConversationModal(props: Required<ConversationSettingsModalState>) {
  const onClose = useCloseActionFromPage(props);
  const title = useTitleFromPage(props?.settingsModalPage);
  const backAction = useBackActionForPage(props);

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
  if (!props?.conversationId) {
    return null;
  }

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
    <SessionWrapperModal
      modalId="conversationSettingsModal"
      headerChildren={
        <ModalBasicHeader
          title={title}
          bigHeader={true}
          extraLeftButton={backAction ? <ModalBackButton onClick={backAction} /> : undefined}
        />
      }
      onClose={onClose}
      topAnchor="5vh"
      shouldOverflow={true}
      allowOutsideClick={false}
      $contentMinWidth={WrapperModalWidth.narrow} // the content is radio buttons and it looks weird on a large modal
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Outline}>
          <SessionButton
            onClick={handleSetNotifications}
            dataTestId={'notifications-set-button'}
            disabled={noChanges}
          >
            {tr('set')}
          </SessionButton>
        </ModalActionsContainer>
      }
    >
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
                    <PanelButtonText
                      text={{ token: option.token }}
                      textDataTestId="invalid-data-testid"
                    />
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
        </Flex>
      </StyledScrollContainer>
      <SpacerMD />
    </SessionWrapperModal>
  );
}
