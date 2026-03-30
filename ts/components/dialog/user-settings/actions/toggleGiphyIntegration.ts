import { SettingsKey } from '../../../../data/settings-key';
import { updateConfirmModal } from '../../../../state/ducks/modalDialog';
import { SessionButtonColor } from '../../../basic/SessionButton';

export async function toggleGiphyIntegration(currentlyEnabled: boolean, onTurnOn?: () => void) {
  if (!currentlyEnabled) {
    window.inboxStore?.dispatch(
      updateConfirmModal({
        title: { token: 'giphyWarning' },
        i18nMessage: { token: 'giphyWarningDescription' },
        okTheme: SessionButtonColor.Danger,
        okText: { token: 'theContinue' },
        onClickOk: async () => {
          const newValue = !currentlyEnabled;

          await window.setSettingValue(SettingsKey.hasGiphyIntegrationEnabled, newValue);
          onTurnOn?.();
        },
        onClickClose: () => {
          window.inboxStore?.dispatch(updateConfirmModal(null));
        },
      })
    );
  } else {
    await window.setSettingValue(SettingsKey.hasGiphyIntegrationEnabled, false);
  }
}
