import { hexColorToRGB } from '../util/hexColorToRGB';
import { COLORS, THEMES } from './constants/colors';
import { ThemeColorVariables } from './variableColors';

export const oceanLight: ThemeColorVariables = {
  '--danger-color': THEMES.OCEAN_LIGHT.DANGER,
  '--warning-color': THEMES.OCEAN_LIGHT.WARNING,
  '--disabled-color': THEMES.OCEAN_LIGHT.DISABLED,

  '--background-primary-color': THEMES.OCEAN_LIGHT.COLOR7!,
  '--background-secondary-color': THEMES.OCEAN_LIGHT.COLOR6,
  '--background-tertiary-color': THEMES.OCEAN_LIGHT.COLOR5,

  '--text-primary-color': THEMES.OCEAN_LIGHT.COLOR1,
  '--text-secondary-color': THEMES.OCEAN_LIGHT.COLOR2,
  '--text-selection-color': `rgba(${hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR1)}, 0.5)`,

  '--borders-color': THEMES.OCEAN_LIGHT.COLOR3,

  '--message-bubble-outgoing-background-color': 'var(--primary-color)',
  '--message-bubble-incoming-background-color': THEMES.OCEAN_LIGHT.COLOR4,
  '--message-bubble-outgoing-text-color': 'var(--text-primary-color)',
  '--message-bubble-incoming-text-color': 'var(--text-primary-color)',

  '--menu-button-background-hover-color': 'var(--text-primary-color)',
  '--menu-button-icon-color': 'var(--text-primary-color)',
  '--menu-button-icon-hover-color': THEMES.OCEAN_LIGHT.COLOR5,
  '--menu-button-border-color': 'var(--text-primary-color)',
  '--menu-button-border-hover-color': 'var(--text-primary-color)',

  '--chat-buttons-background-color': THEMES.OCEAN_LIGHT.COLOR5,
  '--chat-buttons-background-hover-color': THEMES.OCEAN_LIGHT.COLOR3,
  '--chat-buttons-icon-color': 'var(--text-primary-color)',

  '--button-outline-background-color': 'var(--transparent-color)',
  '--button-outline-background-hover-color': 'var(--text-primary-color)',
  '--button-outline-text-color': 'var(--text-primary-color)',
  '--button-outline-text-hover-color': THEMES.OCEAN_LIGHT.COLOR7!,
  '--button-outline-border-color': 'var(--text-primary-color)',
  '--button-outline-border-hover-color': 'var(--text-primary-color)',

  '--button-solid-background-hover-color': 'var(--transparent-color)',
  '--button-solid-text-hover-color': 'var(--text-primary-color)',

  '--button-simple-text-color': 'var(--text-primary-color)',

  '--button-icon-background-color': 'var(--transparent-color)',
  '--button-icon-stroke-hover-color': 'var(--text-primary-color)',
  '--button-icon-stroke-selected-color': 'var(--text-primary-color)',

  '--conversation-tab-background-color': 'var(--background-primary-color)',
  '--conversation-tab-background-hover-color': THEMES.OCEAN_LIGHT.COLOR5,
  '--conversation-tab-background-selected-color': THEMES.OCEAN_LIGHT.COLOR5,
  '--conversation-tab-background-unread-color': 'var(--background-secondary-color)',
  '--conversation-tab-text-selected-color': 'var(--text-primary-color)',
  '--conversation-tab-text-unread-color': 'var(--text-primary-color)',

  '--search-bar-background-color': THEMES.OCEAN_LIGHT.COLOR5,

  '--scroll-bar-track-color': `rgba(${hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR2)}, 0.10)`,
  '--scroll-bar-track-hover-color': `rgba(${hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR2)}, 0.20)`,
  '--scroll-bar-thumb-color': `rgba(${hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR2)}, 0.20)`,
  '--scroll-bar-thumb-hover-color': `rgba(${hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR2)}, 1.0)`,

  '--toggle-switch-ball-shadow-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.15)`,
  '--toggle-switch-off-border-color': 'var(--borders-color)',

  '--unread-bubble-text-color': THEMES.OCEAN_LIGHT.COLOR0,

  '--button-color-mode-stroke-color': 'var(--text-secondary-color)',
  '--button-color-mode-hover-color': 'var(--text-primary-color)',
  '--button-color-mode-fill-color': 'var(--transparent-color)',

  '--emoji-reaction-bar-background-color': 'var(--background-primary-color)',
  '--emoji-reaction-bar-icon-background-color': 'var(--background-secondary-color)',

  '--modal-background-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.2)`,
  '--modal-background-content-color': 'var(--background-primary-color)',
  '--modal-shadow-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.25)`,
  '--modal-drop-shadow': `0px 0px 40px 0px var(--modal-shadow-color)`,

  '--toast-background-color': 'var(--background-primary-color)',

  '--session-logo-text-light-filter': 'brightness(0) saturate(100%)',
  '--session-logo-text-current-filter': 'var(--session-logo-text-light-filter)',

  '--suggestions-background-color': 'var(--background-secondary-color)',
  '--suggestions-background-hover-color': THEMES.OCEAN_LIGHT.COLOR4,

  '--input-text-color': 'var(--text-primary-color)',

  '--call-buttons-background-color': THEMES.OCEAN_LIGHT.COLOR4,
  '--call-buttons-background-hover-color': THEMES.OCEAN_LIGHT.COLOR4,
  '--call-buttons-background-disabled-color': THEMES.OCEAN_LIGHT.COLOR5,
  '--call-buttons-action-background-color': THEMES.OCEAN_LIGHT.COLOR4,
  '--call-buttons-action-background-hover-color': THEMES.OCEAN_LIGHT.COLOR5,
  '--call-buttons-icon-color': 'var(--text-primary-color)',
  '--call-buttons-icon-disabled-color': 'var(--disabled-color)',

  '--file-dropzone-border-color': 'var(--text-primary-color)',

  '--session-recording-pulse-color': hexColorToRGB(THEMES.OCEAN_LIGHT.DANGER),

  '--renderer-span-primary-color': 'var(--text-primary-color)',
};
