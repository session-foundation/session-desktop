/**
 * File is TSX so we get color highlighting in VS Code.
 * Primary color -> Default accent color for a theme
 */

import { tr } from '../../localization/localeTools';

// Colors
export type ColorsType = {
  PRIMARY: {
    GREEN: string;
    BLUE: string;
    YELLOW: string;
    PINK: string;
    PURPLE: string;
    ORANGE: string;
    RED: string;
  };
  PATH: {
    DEFAULT: string;
    CONNECTING: string;
    ERROR: string;
  };
  SESSION: string;
  TRANSPARENT: string;
  WHITE: string;
  BLACK: string;
  NEARBLACK: string;
  GREY: string;
};

// Session Brand Color
const sessionGreen = '#00f782';

// Primary (can override theme default)
const primaryGreen = '#31F196';
const primaryBlue = '#57C9FA';
const primaryYellow = '#FAD657';
const primaryPink = '#FF95EF';
const primaryPurple = '#C993FF';
const primaryOrange = '#FCB159';
const primaryRed = '#FF9C8E';

// Danger
const dangerLight = '#E12D19';
const dangerDark = '#FF3A3A';

// Warning
const warningLight = '#A64B00';
const warningDark = '#FCB159';

// Disabled
const disabledDark = '#6D6D6D';
const disabledLight = '#A1A2A1';

// Path
const pathDefault = primaryGreen;
const pathConnecting = primaryOrange;
const pathError = '#EA5545';

// Transparent
const transparent = 'transparent';

// White
const white = '#FFF';

// Black
const black = '#000';
const nearBlack = '#0d0d0d';

// Grey
const grey = '#616161';

const COLORS: ColorsType = {
  PRIMARY: {
    GREEN: primaryGreen,
    BLUE: primaryBlue,
    YELLOW: primaryYellow,
    PINK: primaryPink,
    PURPLE: primaryPurple,
    ORANGE: primaryOrange,
    RED: primaryRed,
  },
  PATH: {
    DEFAULT: pathDefault,
    CONNECTING: pathConnecting,
    ERROR: pathError,
  },
  SESSION: sessionGreen,
  TRANSPARENT: transparent,
  WHITE: white,
  BLACK: black,
  NEARBLACK: nearBlack,
  GREY: grey,
};

export type PrimaryColorStateType =
  | 'green'
  | 'blue'
  | 'yellow'
  | 'pink'
  | 'purple'
  | 'orange'
  | 'red';

type PrimaryColorType = { id: PrimaryColorStateType; ariaLabel: string; color: string };

export const getPrimaryColors = (): Array<PrimaryColorType> => [
  { id: 'green', ariaLabel: 'Primary color green', color: COLORS.PRIMARY.GREEN },
  { id: 'blue', ariaLabel: 'Primary color blue', color: COLORS.PRIMARY.BLUE },
  { id: 'yellow', ariaLabel: 'Primary color yellow', color: COLORS.PRIMARY.YELLOW },
  { id: 'pink', ariaLabel: 'Primary color pink', color: COLORS.PRIMARY.PINK },
  { id: 'purple', ariaLabel: 'Primary color purple', color: COLORS.PRIMARY.PURPLE },
  { id: 'orange', ariaLabel: 'Primary color orange', color: COLORS.PRIMARY.ORANGE },
  { id: 'red', ariaLabel: 'Primary color red', color: COLORS.PRIMARY.RED },
];

// Themes
export type ThemeStateType = 'classic-light' | 'classic-dark' | 'ocean-light' | 'ocean-dark'; // used for redux state
export const themesArray = [
  'classic-light',
  'classic-dark',
  'ocean-light',
  'ocean-dark',
] satisfies Array<ThemeStateType>;

type ThemeNames = 'CLASSIC_LIGHT' | 'CLASSIC_DARK' | 'OCEAN_LIGHT' | 'OCEAN_DARK';

export function convertThemeStateToName(themeState: string): ThemeNames {
  return themeState.replace('-', '_').toUpperCase() as ThemeNames;
}

const THEMES = {
  CLASSIC_LIGHT: {
    PRIMARY: primaryGreen,
    DANGER: dangerLight,
    WARNING: warningLight,
    DISABLED: disabledLight,
    COLOR0: '#000000',
    COLOR1: '#6D6D6D',
    COLOR2: '#A1A2A1',
    COLOR3: '#DFDFDF',
    COLOR4: '#F0F0F0',
    COLOR5: '#F9F9F9',
    COLOR6: '#FFFFFF',
  },
  CLASSIC_DARK: {
    PRIMARY: primaryGreen,
    DANGER: dangerDark,
    WARNING: warningDark,
    DISABLED: disabledDark,
    COLOR0: '#000000',
    COLOR1: '#1B1B1B',
    COLOR2: '#2D2D2D',
    COLOR3: '#414141',
    COLOR4: '#767676',
    COLOR5: '#A1A2A1',
    COLOR6: '#FFFFFF',
  },
  OCEAN_LIGHT: {
    PRIMARY: primaryBlue,
    DANGER: dangerLight,
    WARNING: warningLight,
    DISABLED: disabledLight,
    COLOR0: '#000000',
    COLOR1: '#19345D',
    COLOR2: '#6A6E90',
    COLOR3: '#5CAACC',
    COLOR4: '#B3EDF2',
    COLOR5: '#E7F3F4',
    COLOR6: '#ECFAFB',
    COLOR7: '#FCFFFF',
  },
  OCEAN_DARK: {
    PRIMARY: primaryBlue,
    DANGER: dangerDark,
    WARNING: warningDark,
    DISABLED: disabledDark,
    COLOR0: '#000000',
    COLOR1: '#1A1C28',
    COLOR2: '#252735',
    COLOR3: '#2B2D40',
    COLOR4: '#3D4A5D',
    COLOR5: '#A6A9CE',
    COLOR6: '#5CAACC',
    COLOR7: '#FFFFFF',
  },
} as const;

type ThemeType = {
  id: ThemeStateType;
  title: string;
  style: StyleSessionSwitcher;
};

export type StyleSessionSwitcher = {
  background: string;
  border: string;
  receivedBackground: string;
  sentBackground: string;
};

export const getThemeColors = (): Array<ThemeType> => [
  {
    id: 'classic-dark',
    title: tr('appearanceThemesClassicDark'),
    style: {
      background: THEMES.CLASSIC_DARK.COLOR0,
      border: THEMES.CLASSIC_DARK.COLOR3,
      receivedBackground: THEMES.CLASSIC_DARK.COLOR2,
      sentBackground: THEMES.CLASSIC_DARK.PRIMARY,
    },
  },
  {
    id: 'classic-light',
    title: tr('appearanceThemesClassicLight'),
    style: {
      background: THEMES.CLASSIC_LIGHT.COLOR6,
      border: THEMES.CLASSIC_LIGHT.COLOR3,
      receivedBackground: THEMES.CLASSIC_LIGHT.COLOR4,
      sentBackground: THEMES.CLASSIC_LIGHT.PRIMARY,
    },
  },
  {
    id: 'ocean-dark',
    title: tr('appearanceThemesOceanDark'),
    style: {
      background: THEMES.OCEAN_DARK.COLOR2,
      border: THEMES.OCEAN_DARK.COLOR4,
      receivedBackground: THEMES.OCEAN_DARK.COLOR4,
      sentBackground: THEMES.OCEAN_DARK.PRIMARY,
    },
  },
  {
    id: 'ocean-light',
    title: tr('appearanceThemesOceanLight'),
    style: {
      background: THEMES.OCEAN_LIGHT.COLOR7!,
      border: THEMES.OCEAN_LIGHT.COLOR3,
      receivedBackground: THEMES.OCEAN_LIGHT.COLOR1,
      sentBackground: THEMES.OCEAN_LIGHT.PRIMARY,
    },
  },
];

export { COLORS, THEMES };
