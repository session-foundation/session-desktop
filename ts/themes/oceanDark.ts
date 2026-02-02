import { hexColorToRGB } from '../util/hexColorToRGB';
import { COLORS, THEMES } from './constants/colors';
import { ThemeColorVariables } from './variableColors';

export const oceanDark: ThemeColorVariables = {
  '--danger-color': THEMES.OCEAN_DARK.DANGER,
  '--warning-color': THEMES.OCEAN_DARK.WARNING,
  '--disabled-color': THEMES.OCEAN_DARK.DISABLED,

  '--background-primary-color': THEMES.OCEAN_DARK.COLOR1,
  '--background-secondary-color': THEMES.OCEAN_DARK.COLOR2,
  '--background-tertiary-color': THEMES.OCEAN_DARK.COLOR3,

  '--text-primary-color': THEMES.OCEAN_DARK.COLOR7!,
  '--text-secondary-color': THEMES.OCEAN_DARK.COLOR5,
  '--text-selection-color': `rgba(${hexColorToRGB(THEMES.OCEAN_DARK.COLOR7!)}, 0.5)`,

  '--borders-color': THEMES.OCEAN_DARK.COLOR4,

  '--message-bubble-outgoing-background-color': 'var(--primary-color)',
  '--message-bubble-incoming-background-color': THEMES.OCEAN_DARK.COLOR4,
  '--message-bubble-outgoing-text-color': THEMES.OCEAN_DARK.COLOR0,
  '--message-bubble-incoming-text-color': 'var(--text-primary-color)',

  '--menu-button-background-hover-color': 'var(--primary-color)',
  '--menu-button-icon-color': 'var(--primary-color)',
  '--menu-button-icon-hover-color': 'var(--text-primary-color)',
  '--menu-button-border-color': 'var(--primary-color)',
  '--menu-button-border-hover-color': 'var(--primary-color)',

  '--chat-buttons-background-color': THEMES.OCEAN_DARK.COLOR2,
  '--chat-buttons-background-hover-color': THEMES.OCEAN_DARK.COLOR4,
  '--chat-buttons-icon-color': THEMES.OCEAN_DARK.COLOR7!,

  '--button-outline-background-color': 'var(--transparent-color)',
  '--button-outline-background-hover-color': 'var(--text-primary-color)',
  '--button-outline-text-color': 'var(--text-primary-color)',
  '--button-outline-text-hover-color': THEMES.OCEAN_DARK.COLOR1,
  '--button-outline-border-color': 'var(--text-primary-color)',
  '--button-outline-border-hover-color': 'var(--text-primary-color)',

  '--button-solid-background-hover-color': 'var(--transparent-color)',
  '--button-solid-text-hover-color': 'var(--text-primary-color)',

  '--button-simple-text-color': 'var(--text-primary-color)',

  '--button-icon-background-color': 'var(--transparent-color)',
  '--button-icon-stroke-hover-color': 'var(--text-primary-color)',
  '--button-icon-stroke-selected-color': 'var(--text-primary-color)',

  '--conversation-tab-background-color': 'var(--background-primary-color)',
  '--conversation-tab-background-hover-color': THEMES.OCEAN_DARK.COLOR3,
  '--conversation-tab-background-selected-color': THEMES.OCEAN_DARK.COLOR3,
  '--conversation-tab-background-unread-color': THEMES.OCEAN_DARK.COLOR2,
  '--conversation-tab-text-selected-color': 'var(--text-primary-color)',
  '--conversation-tab-text-unread-color': 'var(--text-primary-color)',

  '--search-bar-background-color': THEMES.OCEAN_DARK.COLOR3,

  '--scroll-bar-track-color': `rgba(${hexColorToRGB(THEMES.OCEAN_DARK.COLOR5)}, 0.10)`,
  '--scroll-bar-track-hover-color': `rgba(${hexColorToRGB(THEMES.OCEAN_DARK.COLOR5)}, 0.20)`,
  '--scroll-bar-thumb-color': `rgba(${hexColorToRGB(THEMES.OCEAN_DARK.COLOR5)}, 0.20)`,
  '--scroll-bar-thumb-hover-color': `rgba(${hexColorToRGB(THEMES.OCEAN_DARK.COLOR5)}, 1.0)`,

  '--toggle-switch-ball-shadow-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.15)`,
  '--toggle-switch-off-border-color': 'var(--white-color)',

  '--unread-bubble-text-color': THEMES.OCEAN_DARK.COLOR0,

  '--button-color-mode-stroke-color': 'var(--text-secondary-color)',
  '--button-color-mode-hover-color': 'var(--text-secondary-color)',
  '--button-color-mode-fill-color': 'var(--transparent-color)',

  '--emoji-reaction-bar-background-color': 'var(--background-secondary-color)',
  '--emoji-reaction-bar-icon-background-color': 'var(--background-primary-color)',

  '--modal-background-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.5)`,
  '--modal-background-content-color': 'var(--background-secondary-color)',
  '--modal-shadow-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 1.0)`,
  '--modal-drop-shadow': `0px 0px 34px 0px var(--modal-shadow-color)`,

  '--toast-background-color': 'var(--background-secondary-color)',

  '--session-logo-text-light-filter': 'none',
  '--session-logo-text-current-filter': 'var(--session-logo-text-light-filter)',

  '--suggestions-background-color': 'var(--background-secondary-color)',
  '--suggestions-background-hover-color': THEMES.OCEAN_DARK.COLOR4,

  '--input-text-color': 'var(--text-primary-color)',

  '--call-buttons-background-color': THEMES.OCEAN_DARK.COLOR4,
  '--call-buttons-background-hover-color': THEMES.OCEAN_DARK.COLOR4,
  '--call-buttons-background-disabled-color': THEMES.OCEAN_DARK.COLOR3,
  '--call-buttons-action-background-color': 'var(--white-color)',
  '--call-buttons-action-background-hover-color': `rgba(${hexColorToRGB(COLORS.WHITE)}, 0.87)`,
  '--call-buttons-icon-color': THEMES.OCEAN_DARK.COLOR7!,
  '--call-buttons-icon-disabled-color': THEMES.OCEAN_DARK.COLOR7!,

  '--file-dropzone-border-color': 'var(--primary-color)',

  '--session-recording-pulse-color': hexColorToRGB(THEMES.OCEAN_DARK.DANGER),

  '--renderer-span-primary-color': 'var(--primary-color)',
};
