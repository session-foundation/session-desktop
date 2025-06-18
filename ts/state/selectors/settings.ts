import { useSelector } from 'react-redux';
import { SettingsKey } from '../../data/settings-key';
import { StateType } from '../reducer';

const getLinkPreviewEnabled = (state: StateType) =>
  state.settings.settingsBools[SettingsKey.settingsLinkPreview];

const getHasBlindedMsgRequestsEnabled = (state: StateType) =>
  state.settings.settingsBools[SettingsKey.hasBlindedMsgRequestsEnabled];

const getHasFollowSystemThemeEnabled = (state: StateType) =>
  state.settings.settingsBools[SettingsKey.hasFollowSystemThemeEnabled];

const getHasShiftSendEnabled = (state: StateType) =>
  state.settings.settingsBools[SettingsKey.hasShiftSendEnabled];

const getHideRecoveryPassword = (state: StateType) =>
  state.settings.settingsBools[SettingsKey.hideRecoveryPassword];

const getShowOnboardingAccountJustCreated = (state: StateType) =>
  state.settings.settingsBools[SettingsKey.showOnboardingAccountJustCreated];

export const useHasLinkPreviewEnabled = () => {
  const value = useSelector(getLinkPreviewEnabled);
  return Boolean(value);
};

export const useHasBlindedMsgRequestsEnabled = () => {
  const value = useSelector(getHasBlindedMsgRequestsEnabled);
  return Boolean(value);
};

export const useHasFollowSystemThemeEnabled = () => {
  const value = useSelector(getHasFollowSystemThemeEnabled);
  return Boolean(value);
};

export const useHasEnterSendEnabled = () => {
  const value = useSelector(getHasShiftSendEnabled);

  return Boolean(value);
};

export const useHideRecoveryPasswordEnabled = () => {
  const value = useSelector(getHideRecoveryPassword);

  return Boolean(value);
};

export const useShowOnboardingAccountJustCreated = () => {
  const value = useSelector(getShowOnboardingAccountJustCreated);

  return Boolean(value);
};
