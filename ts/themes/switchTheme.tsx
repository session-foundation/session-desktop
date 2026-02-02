import { Dispatch } from '@reduxjs/toolkit';
import { updateTheme } from '../state/theme/ducks/theme';
import { THEMES, ThemeStateType, convertThemeStateToName } from './constants/colors';
import { setThemeValues } from './globals';
import { findPrimaryColorId, switchPrimaryColorTo } from './switchPrimaryColor';
import { SettingsKey } from '../data/settings-key';
import { buildThemeColors } from './allThemes';

type SwitchThemeProps = {
  theme: ThemeStateType;
  mainWindow?: boolean;
  usePrimaryColor?: boolean;
  dispatch?: Dispatch;
};

export async function switchThemeTo(props: SwitchThemeProps) {
  const { theme, mainWindow, usePrimaryColor, dispatch } = props;
  let newTheme: ThemeStateType | null = null;

  switch (theme) {
    case 'classic-dark':
      setThemeValues(buildThemeColors(theme));
      newTheme = 'classic-dark';
      break;
    case 'classic-light':
      setThemeValues(buildThemeColors(theme));
      newTheme = 'classic-light';
      break;
    case 'ocean-dark':
      setThemeValues(buildThemeColors(theme));
      newTheme = 'ocean-dark';
      break;
    case 'ocean-light':
      setThemeValues(buildThemeColors(theme));
      newTheme = 'ocean-light';
      break;
    default:
      window.log.warn('Unsupported theme: ', theme);
  }

  if (newTheme) {
    if (mainWindow) {
      await window.setSettingValue(SettingsKey.settingsTheme, theme);
    }

    if (dispatch) {
      dispatch(updateTheme(newTheme));
      if (usePrimaryColor) {
        // Set primary color after the theme is loaded so that it's not overwritten
        const primaryColor = window.Events.getPrimaryColorSetting();
        await switchPrimaryColorTo(primaryColor, dispatch);
      } else {
        // By default, when we change themes we want to reset the primary color
        const defaultPrimaryColor = findPrimaryColorId(
          THEMES[convertThemeStateToName(newTheme)].PRIMARY
        );
        if (defaultPrimaryColor) {
          await switchPrimaryColorTo(defaultPrimaryColor, dispatch);
        }
      }
    }
  }
}
