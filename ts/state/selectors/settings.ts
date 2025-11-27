import { useDispatch, useSelector } from 'react-redux';
import { useCallback } from 'react';
import { type SettingsBoolKey, SettingsKey } from '../../data/settings-key';
import { StateType } from '../reducer';
import { CallManager, ToastUtils, UserUtils } from '../../session/utils';
import { updateSettingsBoolValue } from '../ducks/settings';
import { isLinux, isMacOS } from '../../OS';
import { type ConfirmModalState, updateConfirmModal } from '../ducks/modalDialog';
import { tr } from '../../localization/localeTools';
import { SessionButtonColor } from '../../components/basic/SessionButton';
import { SessionUtilUserProfile } from '../../session/utils/libsession/libsession_utils_user_profile';
import { ensureThemeConsistency } from '../../themes/SessionTheme';

type UseSettingsBoolOptions = {
  changeSettingFn?: (newValue: boolean) => Promise<void>;
  // If set, will only be called if the call to changeSettingFn succeeds (if defined) and if the ipc call succeeds.
  successCallbackFn?: (newValue: boolean) => Promise<void>;
  confirmationModal?: {
    options: Omit<NonNullable<ConfirmModalState>, 'onClickOk' | 'onClickClose'>;
    // Function that takes the newValue and returns whether to show the modal, if undefined the modal always shows
    showCallbackModal?: (newValue: boolean) => boolean;
  };
};

function useSetSettingsValue(
  key: SettingsBoolKey,
  changeSettingFn?: (newValue: boolean) => Promise<void>
) {
  const dispatch = useDispatch();

  return useCallback(
    async (value: boolean) => {
      await changeSettingFn?.(value);
      await window.setSettingsValue(key, value);
      dispatch(updateSettingsBoolValue({ id: key, value }));
    },
    [dispatch, key, changeSettingFn]
  );
}

const useSettingsBool = (key: SettingsBoolKey, options?: UseSettingsBoolOptions) => {
  const dispatch = useDispatch();

  const setFn = useSetSettingsValue(key, options?.changeSettingFn);

  const enabled = Boolean(useSelector((state: StateType) => state.settings.settingsBools[key]));

  const executeToggle = useCallback(
    async (newValue: boolean) => {
      await setFn(newValue);
      if (options?.successCallbackFn) {
        await options?.successCallbackFn(newValue);
      }
    },
    [options, setFn]
  );

  const toggle = useCallback(async () => {
    try {
      const newValue = !enabled;

      if (options?.confirmationModal?.showCallbackModal?.(newValue)) {
        dispatch(
          updateConfirmModal({
            ...options.confirmationModal.options,
            onClickOk: async () => executeToggle(newValue),
            onClickClose: async () => dispatch(updateConfirmModal(null)),
          })
        );
      } else {
        await executeToggle(newValue);
      }
    } catch (e) {
      window.log.error(e);
    }
  }, [enabled, dispatch, executeToggle, options?.confirmationModal]);

  return {
    toggle,
    enabled,
  };
};

export const useHasLinkPreviewSetting = () => {
  return useSettingsBool(SettingsKey.settingsLinkPreview, {
    confirmationModal: {
      showCallbackModal: newValue => newValue,
      options: {
        title: tr('linkPreviewsSend'),
        i18nMessage: { token: 'linkPreviewsSendModalDescription' },
        okTheme: SessionButtonColor.Danger,
        okText: tr('theContinue'),
      },
    },
  });
};

export const useWeHaveBlindedMsgRequestsSetting = () => {
  const successCallbackFn = useCallback(async () => {
    await SessionUtilUserProfile.insertUserProfileIntoWrapper(UserUtils.getOurPubKeyStrFromCache());
  }, []);

  return useSettingsBool(SettingsKey.settingsBlindedMsgRequests, {
    successCallbackFn,
  });
};

export const useFollowSystemThemeSetting = () => {
  const successCallbackFn = useCallback(async (newValue: boolean) => {
    if (newValue) {
      await ensureThemeConsistency();
    }
  }, []);

  return useSettingsBool(SettingsKey.settingsFollowSystemTheme, {
    successCallbackFn,
  });
};

export const useHideMenuBarSetting = () => {
  return useSettingsBool(SettingsKey.settingsHideMenuBar);
};

export const useShiftEnterSendSetting = () => {
  return useSettingsBool(SettingsKey.settingsShiftSend);
};

export const useHideRecoveryPasswordSetting = () => {
  return useSettingsBool(SettingsKey.settingsHideRecoveryPassword);
};

export const useShowOnboardingAccountJustCreatedSetting = () => {
  return useSettingsBool(SettingsKey.settingsShowOnboardingAccountJustCreated);
};

export const useAutoUpdateSetting = () => {
  return useSettingsBool(SettingsKey.settingsAutoUpdate);
};

export const useOpengroupPruningSetting = () => {
  return useSettingsBool(SettingsKey.settingsOpenGroupPruning);
};

export const useTypingIndicatorSetting = () => {
  return useSettingsBool(SettingsKey.settingsTypingIndicator);
};

export const useReadReceiptSetting = () => {
  return useSettingsBool(SettingsKey.settingsReadReceipt);
};

export const usePermissionMediaSettings = () => {
  const mediaPermissionSetting = useSettingsBool(SettingsKey.settingsPermissionMedia);

  const callMediaSuccessCallbackFn = useCallback(
    async (newValue: boolean) => {
      if (newValue) {
        if (!mediaPermissionSetting.enabled) {
          await mediaPermissionSetting.toggle();
        }
        CallManager.onTurnedOnCallMediaPermissions();
      }
    },
    [mediaPermissionSetting]
  );

  const toggleCallMediaPermission = useCallback(async (newValue: boolean) => {
    if (newValue) {
      if (isMacOS()) {
        window.askForMediaAccess();
      }
    }
  }, []);

  const callMediaPermissionSetting = useSettingsBool(SettingsKey.settingsPermissionCallMedia, {
    successCallbackFn: callMediaSuccessCallbackFn,
    changeSettingFn: toggleCallMediaPermission,
    confirmationModal: {
      showCallbackModal: newValue => newValue,
      options: {
        title: tr('callsVoiceAndVideoBeta'),
        i18nMessage: { token: 'callsVoiceAndVideoModalDescription' },
        okTheme: SessionButtonColor.Danger,
        okText: tr('theContinue'),
      },
    },
  });

  const toggleMediaPermission = useCallback(async () => {
    if (mediaPermissionSetting.enabled) {
      if (callMediaPermissionSetting.enabled) {
        window.log.info('toggleMediaPermissions : forcing callPermissions to false');
        await callMediaPermissionSetting.toggle();
      }
    }

    if (!mediaPermissionSetting.enabled && isMacOS()) {
      window.askForMediaAccess();
    }

    await mediaPermissionSetting.toggle();
  }, [mediaPermissionSetting, callMediaPermissionSetting]);

  return {
    toggleCallMediaPermission: callMediaPermissionSetting.toggle,
    toggleMediaPermission,
    mediaPermissionEnabled: mediaPermissionSetting.enabled,
    callMediaPermissionEnabled: callMediaPermissionSetting.enabled,
  };
};

export const useStartInTraySetting = () => {
  const successCallbackFn = useCallback(async (newValue: boolean) => {
    if (!newValue) {
      ToastUtils.pushRestartNeeded();
    }
  }, []);

  return useSettingsBool(SettingsKey.settingsStartInTray, { successCallbackFn });
};

export const useAutoStartSetting = () => {
  const unavailable = isLinux();
  return {
    ...useSettingsBool(SettingsKey.settingsAutoStart),
    unavailable,
  };
};
