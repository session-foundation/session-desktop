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
  useHasBlindedMsgRequestsEnabled,
  useHasLinkPreviewEnabled,
} from '../../../state/selectors/settings';
import { Storage } from '../../../util/storage';
import { SessionSettingButtonItem, SessionToggleWithDescription } from '../SessionSettingListItem';
import { displayPasswordModal } from '../SessionSettings';
import { ConversationTypeEnum } from '../../../models/types';

async function toggleLinkPreviews(isToggleOn: boolean, forceUpdate: () => void) {
  if (!isToggleOn) {
    window.inboxStore?.dispatch(
      updateConfirmModal({
        title: window.i18n('linkPreviewsSend'),
        i18nMessage: { token: 'linkPreviewsSendModalDescription' },
        okTheme: SessionButtonColor.Danger,
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
  const areBlindedRequestsEnabled = useHasBlindedMsgRequestsEnabled();

  return (
    <>
      <SessionToggleWithDescription
        onClickToggle={async () => {
          const old = Boolean(window.getSettingValue(SettingsKey.settingsReadReceipt));
          await window.setSettingValue(SettingsKey.settingsReadReceipt, !old);
          forceUpdate();
        }}
        title={window.i18n('readReceipts')}
        description={window.i18n('readReceiptsDescription')}
        active={window.getSettingValue(SettingsKey.settingsReadReceipt)}
        dataTestId="enable-read-receipts"
      />
      <SessionToggleWithDescription
        onClickToggle={async () => {
          const old = Boolean(window.getSettingValue(SettingsKey.settingsTypingIndicator));
          await window.setSettingValue(SettingsKey.settingsTypingIndicator, !old);
          forceUpdate();
        }}
        title={window.i18n('typingIndicators')}
        description={window.i18n('typingIndicatorsDescription')}
        active={Boolean(window.getSettingValue(SettingsKey.settingsTypingIndicator))}
        childrenDescription={<TypingBubbleItem />}
      />
      <SessionToggleWithDescription
        onClickToggle={() => {
          void toggleLinkPreviews(isLinkPreviewsOn, forceUpdate);
        }}
        title={window.i18n('linkPreviewsSend')}
        description={window.i18n('linkPreviewsDescription')}
        active={isLinkPreviewsOn}
      />
      <SessionToggleWithDescription
        onClickToggle={async () => {
          const toggledValue = !areBlindedRequestsEnabled;
          await window.setSettingValue(SettingsKey.hasBlindedMsgRequestsEnabled, toggledValue);
          await SessionUtilUserProfile.insertUserProfileIntoWrapper(
            UserUtils.getOurPubKeyStrFromCache()
          );
          forceUpdate();
        }}
        title={window.i18n('messageRequestsCommunities')}
        description={window.i18n('messageRequestsCommunitiesDescription')}
        active={areBlindedRequestsEnabled}
      />

      {!props.hasPassword ? (
        <SessionSettingButtonItem
          title={window.i18n('lockApp')}
          description={window.i18n('passwordDescription')}
          onClick={() => {
            displayPasswordModal('set', props.onPasswordUpdated);
            forceUpdate();
          }}
          buttonText={window.i18n('passwordSet')}
          dataTestId={'set-password-button'}
        />
      ) : (
        <>
          {/* We have a password, let's show the 'change' and 'remove' password buttons */}
          <SessionSettingButtonItem
            title={window.i18n('passwordChange')}
            description={window.i18n('passwordChangeDescription')}
            onClick={() => {
              displayPasswordModal('change', props.onPasswordUpdated);
              forceUpdate();
            }}
            buttonText={window.i18n('passwordChange')}
            dataTestId="change-password-settings-button"
          />
          <SessionSettingButtonItem
            title={window.i18n('passwordRemove')}
            description={window.i18n('passwordRemoveDescription')}
            onClick={() => {
              displayPasswordModal('remove', props.onPasswordUpdated);
              forceUpdate();
            }}
            buttonColor={SessionButtonColor.Danger}
            buttonText={window.i18n('passwordRemove')}
            dataTestId="remove-password-settings-button"
          />
        </>
      )}
    </>
  );
};
