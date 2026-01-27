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

export const getAudioAutoplay = (state: StateType): boolean =>
  state.settings.settingsBools[SettingsKey.audioAutoplay];

export const getShowRecoveryPhrasePrompt = (state: StateType): boolean =>
  state.settings.settingsBools[SettingsKey.showRecoveryPhrasePrompt];

export const getDismissedRecoveryPhrasePrompt = (state: StateType): boolean =>
  state.settings.settingsBools[SettingsKey.dismissedRecoveryPhrasePrompt];

export const getHideMessageRequestBanner = (state: StateType): boolean =>
  state.settings.settingsBools[SettingsKey.hideMessageRequests];

export const useHasLinkPreviewEnabled = () => {
  const value = useSelector(getLinkPreviewEnabled);
  return Boolean(value);
};

export const useWeHaveBlindedMsgRequestsEnabled = () => {
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

export const getHideMessageRequestBannerOutsideRedux = (): boolean => {
  const state = window.inboxStore?.getState();
  return state ? getHideMessageRequestBanner(state) : true;
};
