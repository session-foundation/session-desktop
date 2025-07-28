/* eslint-disable @typescript-eslint/no-misused-promises */

import useUpdate from 'react-use/lib/useUpdate';
import { SettingsKey } from '../../../data/settings-key';
import { updateConfirmModal } from '../../../state/ducks/modalDialog';
import { SessionButtonColor } from '../../basic/SessionButton';
import { SpacerLG } from '../../basic/Text';
import { TypingBubble } from '../../conversation/TypingBubble';

import { UserUtils } from '../../../session/utils';
import { SessionUtilUserProfile } from '../../../session/utils/libsession/libsession_utils_user_profile';
import {
  useWeHaveBlindedMsgRequestsEnabled,
  useHasLinkPreviewEnabled,
} from '../../../state/selectors/settings';
import { Storage } from '../../../util/storage';
import { SessionSettingButtonItem, SessionToggleWithDescription } from '../SessionSettingListItem';
import { displayPasswordModal } from '../SessionSettings';
import { ConversationTypeEnum } from '../../../models/types';
import { tr } from '../../../localization/localeTools';

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

const TypingBubbleItem = () => {
  return (
    <>
      <SpacerLG />
      <TypingBubble conversationType={ConversationTypeEnum.PRIVATE} isTyping={true} />
    </>
  );
};

export const SettingsCategoryPrivacy = (props: {
  hasPassword: boolean | null;
  onPasswordUpdated: (action: string) => void;
}) => {
  const forceUpdate = useUpdate();
  const isLinkPreviewsOn = useHasLinkPreviewEnabled();
  const weHaveBlindedRequestsEnabled = useWeHaveBlindedMsgRequestsEnabled();

  return (
    <>
      <SessionToggleWithDescription
        onClickToggle={async () => {
          const old = Boolean(window.getSettingValue(SettingsKey.settingsReadReceipt));
          await window.setSettingValue(SettingsKey.settingsReadReceipt, !old);
          forceUpdate();
        }}
        title={tr('readReceipts')}
        description={tr('readReceiptsDescription')}
        active={window.getSettingValue(SettingsKey.settingsReadReceipt)}
        dataTestId="enable-read-receipts"
      />
      <SessionToggleWithDescription
        onClickToggle={async () => {
          const old = Boolean(window.getSettingValue(SettingsKey.settingsTypingIndicator));
          await window.setSettingValue(SettingsKey.settingsTypingIndicator, !old);
          forceUpdate();
        }}
        title={tr('typingIndicators')}
        description={tr('typingIndicatorsDescription')}
        active={Boolean(window.getSettingValue(SettingsKey.settingsTypingIndicator))}
        childrenDescription={<TypingBubbleItem />}
      />
      <SessionToggleWithDescription
        onClickToggle={() => {
          void toggleLinkPreviews(isLinkPreviewsOn, forceUpdate);
        }}
        title={tr('linkPreviewsSend')}
        description={tr('linkPreviewsDescription')}
        active={isLinkPreviewsOn}
      />
      <SessionToggleWithDescription
        onClickToggle={async () => {
          const toggledValue = !weHaveBlindedRequestsEnabled;
          await window.setSettingValue(SettingsKey.hasBlindedMsgRequestsEnabled, toggledValue);
          await SessionUtilUserProfile.insertUserProfileIntoWrapper(
            UserUtils.getOurPubKeyStrFromCache()
          );
          forceUpdate();
        }}
        title={tr('messageRequestsCommunities')}
        description={tr('messageRequestsCommunitiesDescription')}
        active={weHaveBlindedRequestsEnabled}
      />

      {!props.hasPassword ? (
        <SessionSettingButtonItem
          title={tr('lockApp')}
          description={tr('passwordDescription')}
          onClick={() => {
            displayPasswordModal('set', props.onPasswordUpdated);
            forceUpdate();
          }}
          buttonText={tr('passwordSet')}
          dataTestId={'set-password-button'}
        />
      ) : (
        <>
          {/* We have a password, let's show the 'change' and 'remove' password buttons */}
          <SessionSettingButtonItem
            title={tr('passwordChange')}
            description={tr('passwordChangeDescription')}
            onClick={() => {
              displayPasswordModal('change', props.onPasswordUpdated);
              forceUpdate();
            }}
            buttonText={tr('passwordChange')}
            dataTestId="change-password-settings-button"
          />
          <SessionSettingButtonItem
            title={tr('passwordRemove')}
            description={tr('passwordRemoveDescription')}
            onClick={() => {
              displayPasswordModal('remove', props.onPasswordUpdated);
              forceUpdate();
            }}
            buttonColor={SessionButtonColor.Danger}
            buttonText={tr('passwordRemove')}
            dataTestId="remove-password-settings-button"
          />
        </>
      )}
    </>
  );
};
