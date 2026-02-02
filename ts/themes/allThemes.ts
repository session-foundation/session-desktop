import { hexColorToRGB } from '../util/hexColorToRGB';
import { COLORS, THEMES, ThemeStateType } from './constants/colors';
import type { ThemeColorVariables } from './variableColors';

type ThemeValue = string;

// Building blocks
type WithAll = { all: ThemeValue };
type WithDark = { dark: ThemeValue };
type WithLight = { light: ThemeValue };
type WithClassic = { classic: ThemeValue };
type WithOcean = { ocean: ThemeValue };
type WithClassicDark = { classicDark: ThemeValue };
type WithClassicLight = { classicLight: ThemeValue };
type WithOceanDark = { oceanDark: ThemeValue };
type WithOceanLight = { oceanLight: ThemeValue };
type WithOthers = { others: ThemeValue };

// All themes share the same value
type AllThemes = WithAll;

// Dark/Light groupings
type DarkLightThemes = WithDark & WithLight;

// Classic/Ocean family groupings
type ClassicOceanThemes = WithClassic & WithOceanDark & WithOceanLight;
type OceanClassicThemes = WithOcean & WithClassicDark & WithClassicLight;

// Partial dark/light (when one pair matches but other doesn't)
type DarkWithLights = WithDark & WithClassicLight & WithOceanLight;
type LightWithDarks = WithLight & WithClassicDark & WithOceanDark;

// Single outlier patterns (3 themes share, 1 differs)
type ClassicDarkOutlier = WithClassicDark & WithOthers;
type ClassicLightOutlier = WithClassicLight & WithOthers;
type OceanDarkOutlier = WithOceanDark & WithOthers;
type OceanLightOutlier = WithOceanLight & WithOthers;

// Full specification when no pattern matches
type FullThemes = WithClassicDark & WithClassicLight & WithOceanDark & WithOceanLight;

export type ThemeEntry =
  | AllThemes
  | DarkLightThemes
  | ClassicOceanThemes
  | OceanClassicThemes
  | DarkWithLights
  | LightWithDarks
  | ClassicDarkOutlier
  | ClassicLightOutlier
  | OceanDarkOutlier
  | OceanLightOutlier
  | FullThemes;

// Maps ThemeStateType (kebab-case) to internal key names (camelCase)
type InternalThemeKey = 'classicDark' | 'classicLight' | 'oceanDark' | 'oceanLight';

const themeStateToKey: Record<ThemeStateType, InternalThemeKey> = {
  'classic-dark': 'classicDark',
  'classic-light': 'classicLight',
  'ocean-dark': 'oceanDark',
  'ocean-light': 'oceanLight',
};

const isDark = (theme: InternalThemeKey): boolean =>
  theme === 'classicDark' || theme === 'oceanDark';
const isClassic = (theme: InternalThemeKey): boolean =>
  theme === 'classicDark' || theme === 'classicLight';

function resolveThemeValue(entry: ThemeEntry, theme: InternalThemeKey): string {
  // All themes share the same value
  if ('all' in entry) {
    return entry.all;
  }

  // Dark/Light groupings
  if ('dark' in entry && 'light' in entry && !('classicDark' in entry) && !('oceanDark' in entry)) {
    return isDark(theme) ? entry.dark : entry.light;
  }

  // Classic/Ocean family groupings
  if ('classic' in entry) {
    if (isClassic(theme)) {
      return entry.classic;
    }
    return theme === 'oceanDark' ? entry.oceanDark : entry.oceanLight;
  }
  if ('ocean' in entry) {
    if (!isClassic(theme)) {
      return entry.ocean;
    }
    return theme === 'classicDark' ? entry.classicDark : entry.classicLight;
  }

  // Partial dark/light (dark themes share, lights differ)
  if ('dark' in entry && 'classicLight' in entry && 'oceanLight' in entry) {
    if (isDark(theme)) {
      return entry.dark;
    }
    return theme === 'classicLight' ? entry.classicLight : entry.oceanLight;
  }

  // Partial dark/light (light themes share, darks differ)
  if ('light' in entry && 'classicDark' in entry && 'oceanDark' in entry) {
    if (!isDark(theme)) {
      return entry.light;
    }
    return theme === 'classicDark' ? entry.classicDark : entry.oceanDark;
  }

  // Single outlier patterns
  if ('others' in entry) {
    if ('classicDark' in entry) {
      return theme === 'classicDark' ? entry.classicDark : entry.others;
    }
    if ('classicLight' in entry) {
      return theme === 'classicLight' ? entry.classicLight : entry.others;
    }
    if ('oceanDark' in entry) {
      return theme === 'oceanDark' ? entry.oceanDark : entry.others;
    }
    if ('oceanLight' in entry) {
      return theme === 'oceanLight' ? entry.oceanLight : entry.others;
    }
  }

  // Full specification
  if (
    'classicDark' in entry &&
    'classicLight' in entry &&
    'oceanDark' in entry &&
    'oceanLight' in entry
  ) {
    return entry[theme];
  }

  throw new Error(`Unable to resolve theme value for theme: ${theme}`);
}

export function buildThemeColors(theme: ThemeStateType): ThemeColorVariables {
  const themeKey = themeStateToKey[theme];
  return Object.entries(allThemes).reduce((acc, [key, entry]) => {
    acc[key as keyof ThemeColorVariables] = resolveThemeValue(entry, themeKey);
    return acc;
  }, {} as ThemeColorVariables);
}

export const allThemes: Record<keyof ThemeColorVariables, ThemeEntry> = {
  '--danger-color': {
    classicDark: THEMES.CLASSIC_DARK.DANGER,
    classicLight: THEMES.CLASSIC_LIGHT.DANGER,
    oceanDark: THEMES.OCEAN_DARK.DANGER,
    oceanLight: THEMES.OCEAN_LIGHT.DANGER,
  },
  '--warning-color': {
    classicDark: THEMES.CLASSIC_DARK.WARNING,
    classicLight: THEMES.CLASSIC_LIGHT.WARNING,
    oceanDark: THEMES.OCEAN_DARK.WARNING,
    oceanLight: THEMES.OCEAN_LIGHT.WARNING,
  },
  '--disabled-color': {
    classicDark: THEMES.CLASSIC_DARK.DISABLED,
    classicLight: THEMES.CLASSIC_LIGHT.DISABLED,
    oceanDark: THEMES.OCEAN_DARK.DISABLED,
    oceanLight: THEMES.OCEAN_LIGHT.DISABLED,
  },

  '--background-primary-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR1,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR6,
    oceanDark: THEMES.OCEAN_DARK.COLOR1,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR7!,
  },
  '--background-secondary-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR0,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR5,
    oceanDark: THEMES.OCEAN_DARK.COLOR2,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR6,
  },
  '--background-tertiary-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR2,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR4,
    oceanDark: THEMES.OCEAN_DARK.COLOR3,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR5,
  },

  '--text-primary-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR6,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR0,
    oceanDark: THEMES.OCEAN_DARK.COLOR7!,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR1,
  },
  '--text-secondary-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR5,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR1,
    oceanDark: THEMES.OCEAN_DARK.COLOR5,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR2,
  },
  '--text-selection-color': {
    classicDark: `rgba(${hexColorToRGB(THEMES.CLASSIC_DARK.COLOR6)}, 0.5)`,
    classicLight: `rgba(${hexColorToRGB(THEMES.CLASSIC_LIGHT.COLOR0)}, 0.5)`,
    oceanDark: `rgba(${hexColorToRGB(THEMES.OCEAN_DARK.COLOR7!)}, 0.5)`,
    oceanLight: `rgba(${hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR1)}, 0.5)`,
  },

  '--borders-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR3,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR3,
    oceanDark: THEMES.OCEAN_DARK.COLOR4,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR3,
  },

  '--message-bubble-outgoing-background-color': { all: 'var(--primary-color)' },
  '--message-bubble-incoming-background-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR2,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR4,
    oceanDark: THEMES.OCEAN_DARK.COLOR4,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR4,
  },
  '--message-bubble-outgoing-text-color': {
    light: 'var(--text-primary-color)',
    classicDark: 'var(--background-primary-color)',
    oceanDark: 'var(--black-color)',
  },
  '--message-bubble-incoming-text-color': { all: 'var(--text-primary-color)' },

  '--menu-button-background-hover-color': {
    dark: 'var(--primary-color)',
    light: 'var(--text-primary-color)',
  },
  '--menu-button-icon-color': {
    dark: 'var(--primary-color)',
    light: 'var(--text-primary-color)',
  },
  '--menu-button-icon-hover-color': {
    dark: 'var(--text-primary-color)',
    classicLight: 'var(--white-color)',
    oceanLight: THEMES.OCEAN_LIGHT.COLOR5,
  },
  '--menu-button-border-color': {
    dark: 'var(--primary-color)',
    light: 'var(--text-primary-color)',
  },
  '--menu-button-border-hover-color': {
    dark: 'var(--primary-color)',
    light: 'var(--text-primary-color)',
  },

  '--chat-buttons-background-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR2,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR4,
    oceanDark: THEMES.OCEAN_DARK.COLOR2,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR5,
  },
  '--chat-buttons-background-hover-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR3,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR3,
    oceanDark: THEMES.OCEAN_DARK.COLOR4,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR3,
  },
  '--chat-buttons-icon-color': {
    oceanDark: THEMES.OCEAN_DARK.COLOR7!,
    others: 'var(--text-primary-color)',
  },

  '--button-outline-background-color': { all: 'var(--transparent-color)' },
  '--button-outline-background-hover-color': { all: 'var(--text-primary-color)' },
  '--button-outline-text-color': { all: 'var(--text-primary-color)' },
  '--button-outline-text-hover-color': {
    classicDark: 'var(--black-color)',
    classicLight: THEMES.CLASSIC_LIGHT.COLOR6,
    oceanDark: THEMES.OCEAN_DARK.COLOR1,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR7!,
  },
  '--button-outline-border-color': { all: 'var(--text-primary-color)' },
  '--button-outline-border-hover-color': { all: 'var(--text-primary-color)' },

  '--button-solid-background-hover-color': { all: 'var(--transparent-color)' },
  '--button-solid-text-hover-color': { all: 'var(--text-primary-color)' },

  '--button-simple-text-color': { all: 'var(--text-primary-color)' },

  '--button-icon-background-color': { all: 'var(--transparent-color)' },
  '--button-icon-stroke-hover-color': { all: 'var(--text-primary-color)' },
  '--button-icon-stroke-selected-color': { all: 'var(--text-primary-color)' },
  '--icon-fill-color': {
    classicLight: 'var(--white-color)',
    others: 'var(--primary-color)',
  },

  '--conversation-tab-background-color': {
    classicLight: 'var(--white-color)',
    others: 'var(--background-primary-color)',
  },
  '--conversation-tab-background-hover-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR3,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR4,
    oceanDark: THEMES.OCEAN_DARK.COLOR3,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR5,
  },
  '--conversation-tab-background-selected-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR3,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR4,
    oceanDark: THEMES.OCEAN_DARK.COLOR3,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR5,
  },
  '--conversation-tab-background-unread-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR2,
    classicLight: 'var(--background-primary-color)',
    oceanDark: THEMES.OCEAN_DARK.COLOR2,
    oceanLight: 'var(--background-secondary-color)',
  },
  '--conversation-tab-text-selected-color': { all: 'var(--text-primary-color)' },
  '--conversation-tab-text-unread-color': { all: 'var(--text-primary-color)' },

  '--search-bar-background-color': {
    classic: 'var(--background-secondary-color)',
    oceanDark: THEMES.OCEAN_DARK.COLOR3,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR5,
  },

  '--scroll-bar-track-color': {
    classicDark: `rgba(${hexColorToRGB(THEMES.CLASSIC_DARK.COLOR5)}, 0.10)`,
    classicLight: `rgba(${hexColorToRGB(THEMES.CLASSIC_LIGHT.COLOR1)}, 0.10)`,
    oceanDark: `rgba(${hexColorToRGB(THEMES.OCEAN_DARK.COLOR5)}, 0.10)`,
    oceanLight: `rgba(${hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR2)}, 0.10)`,
  },
  '--scroll-bar-track-hover-color': {
    classicDark: `rgba(${hexColorToRGB(THEMES.CLASSIC_DARK.COLOR5)}, 0.20)`,
    classicLight: `rgba(${hexColorToRGB(THEMES.CLASSIC_LIGHT.COLOR1)}, 0.20)`,
    oceanDark: `rgba(${hexColorToRGB(THEMES.OCEAN_DARK.COLOR5)}, 0.20)`,
    oceanLight: `rgba(${hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR2)}, 0.20)`,
  },
  '--scroll-bar-thumb-color': {
    classicDark: `rgba(${hexColorToRGB(THEMES.CLASSIC_DARK.COLOR5)}, 0.20)`,
    classicLight: `rgba(${hexColorToRGB(THEMES.CLASSIC_LIGHT.COLOR1)}, 0.20)`,
    oceanDark: `rgba(${hexColorToRGB(THEMES.OCEAN_DARK.COLOR5)}, 0.20)`,
    oceanLight: `rgba(${hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR2)}, 0.20)`,
  },
  '--scroll-bar-thumb-hover-color': {
    classicDark: `rgba(${hexColorToRGB(THEMES.CLASSIC_DARK.COLOR5)}, 1.0)`,
    classicLight: `rgba(${hexColorToRGB(THEMES.CLASSIC_LIGHT.COLOR1)}, 1.0)`,
    oceanDark: `rgba(${hexColorToRGB(THEMES.OCEAN_DARK.COLOR5)}, 1.0)`,
    oceanLight: `rgba(${hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR2)}, 1.0)`,
  },

  '--toggle-switch-ball-shadow-color': { all: `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.15)` },
  '--toggle-switch-off-border-color': {
    dark: 'var(--white-color)',
    light: 'var(--borders-color)',
  },

  '--emoji-reaction-bar-background-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR2,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR4,
    oceanDark: 'var(--background-secondary-color)',
    oceanLight: 'var(--background-primary-color)',
  },
  '--emoji-reaction-bar-icon-background-color': {
    classicDark: 'var(--background-secondary-color)',
    classicLight: 'var(--background-primary-color)',
    oceanDark: 'var(--background-primary-color)',
    oceanLight: 'var(--background-secondary-color)',
  },

  '--modal-background-color': {
    dark: `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.5)`,
    light: `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.2)`,
  },
  '--modal-background-content-color': {
    classicDark: COLORS.NEARBLACK,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR6,
    oceanDark: 'var(--background-secondary-color)',
    oceanLight: 'var(--background-primary-color)',
  },
  '--modal-shadow-color': {
    dark: `rgba(${hexColorToRGB(COLORS.BLACK)}, 1.0)`,
    light: `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.25)`,
  },
  '--modal-drop-shadow': {
    dark: '0px 0px 34px 0px var(--modal-shadow-color)',
    light: '0px 0px 40px 0px var(--modal-shadow-color)',
  },

  '--toast-background-color': {
    oceanDark: 'var(--background-secondary-color)',
    others: 'var(--background-primary-color)',
  },

  '--session-logo-text-light-filter': {
    dark: 'none',
    light: 'brightness(0) saturate(100%)',
  },
  '--session-logo-text-current-filter': { all: 'var(--session-logo-text-light-filter)' },

  '--suggestions-background-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR2,
    others: 'var(--background-secondary-color)',
  },
  '--suggestions-background-hover-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR3,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR4,
    oceanDark: THEMES.OCEAN_DARK.COLOR4,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR4,
  },

  '--input-text-color': { all: 'var(--text-primary-color)' },

  '--call-buttons-background-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR3,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR3,
    oceanDark: THEMES.OCEAN_DARK.COLOR4,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR4,
  },
  '--call-buttons-background-hover-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR4,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR4,
    oceanDark: THEMES.OCEAN_DARK.COLOR4,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR4,
  },
  '--call-buttons-background-disabled-color': {
    classicDark: THEMES.CLASSIC_DARK.COLOR2,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR5,
    oceanDark: THEMES.OCEAN_DARK.COLOR3,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR5,
  },
  '--call-buttons-action-background-color': {
    classicDark: 'var(--white-color)',
    classicLight: THEMES.CLASSIC_LIGHT.COLOR4,
    oceanDark: 'var(--white-color)',
    oceanLight: THEMES.OCEAN_LIGHT.COLOR4,
  },
  '--call-buttons-action-background-hover-color': {
    dark: `rgba(${hexColorToRGB(COLORS.WHITE)}, 0.87)`,
    classicLight: THEMES.CLASSIC_LIGHT.COLOR3,
    oceanLight: THEMES.OCEAN_LIGHT.COLOR5,
  },
  '--call-buttons-icon-color': {
    oceanDark: THEMES.OCEAN_DARK.COLOR7!,
    others: 'var(--text-primary-color)',
  },
  '--call-buttons-icon-disabled-color': {
    light: 'var(--disabled-color)',
    classicDark: 'var(--text-primary-color)',
    oceanDark: 'var(--white-color)',
  },

  '--file-dropzone-border-color': {
    dark: 'var(--primary-color)',
    light: 'var(--text-primary-color)',
  },

  '--session-recording-pulse-color': {
    classicDark: hexColorToRGB(THEMES.CLASSIC_DARK.DANGER),
    classicLight: hexColorToRGB(THEMES.CLASSIC_LIGHT.DANGER),
    oceanDark: hexColorToRGB(THEMES.OCEAN_DARK.DANGER),
    oceanLight: hexColorToRGB(THEMES.OCEAN_LIGHT.DANGER),
  },

  '--renderer-span-primary-color': {
    dark: 'var(--primary-color)',
    light: 'var(--text-primary-color)',
  },
};
