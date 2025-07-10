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
import { localize } from '../../../localization/localeTools';

async function toggleLinkPreviews(isToggleOn: boolean, forceUpdate: () => void) {
  if (!isToggleOn) {
    window.inboxStore?.dispatch(
      updateConfirmModal({
        title: localize('linkPreviewsSend').toString(),
        i18nMessage: { token: 'linkPreviewsSendModalDescription' },
        okTheme: SessionButtonColor.Danger,
        okText: localize('theContinue').toString(),
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
        title={localize('readReceipts').toString()}
        description={localize('readReceiptsDescription').toString()}
        active={window.getSettingValue(SettingsKey.settingsReadReceipt)}
        dataTestId="enable-read-receipts"
      />
      <SessionToggleWithDescription
        onClickToggle={async () => {
          const old = Boolean(window.getSettingValue(SettingsKey.settingsTypingIndicator));
          await window.setSettingValue(SettingsKey.settingsTypingIndicator, !old);
          forceUpdate();
        }}
        title={localize('typingIndicators').toString()}
        description={localize('typingIndicatorsDescription').toString()}
        active={Boolean(window.getSettingValue(SettingsKey.settingsTypingIndicator))}
        childrenDescription={<TypingBubbleItem />}
      />
      <SessionToggleWithDescription
        onClickToggle={() => {
          void toggleLinkPreviews(isLinkPreviewsOn, forceUpdate);
        }}
        title={localize('linkPreviewsSend').toString()}
        description={localize('linkPreviewsDescription').toString()}
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
        title={localize('messageRequestsCommunities').toString()}
        description={localize('messageRequestsCommunitiesDescription').toString()}
        active={areBlindedRequestsEnabled}
      />

      {!props.hasPassword ? (
        <SessionSettingButtonItem
          title={localize('lockApp').toString()}
          description={localize('passwordDescription').toString()}
          onClick={() => {
            displayPasswordModal('set', props.onPasswordUpdated);
            forceUpdate();
          }}
          buttonText={localize('passwordSet').toString()}
          dataTestId={'set-password-button'}
        />
      ) : (
        <>
          {/* We have a password, let's show the 'change' and 'remove' password buttons */}
          <SessionSettingButtonItem
            title={localize('passwordChange').toString()}
            description={localize('passwordChangeDescription').toString()}
            onClick={() => {
              displayPasswordModal('change', props.onPasswordUpdated);
              forceUpdate();
            }}
            buttonText={localize('passwordChange').toString()}
            dataTestId="change-password-settings-button"
          />
          <SessionSettingButtonItem
            title={localize('passwordRemove').toString()}
            description={localize('passwordRemoveDescription').toString()}
            onClick={() => {
              displayPasswordModal('remove', props.onPasswordUpdated);
              forceUpdate();
            }}
            buttonColor={SessionButtonColor.Danger}
            buttonText={localize('passwordRemove').toString()}
            dataTestId="remove-password-settings-button"
          />
        </>
      )}
    </>
  );
};
