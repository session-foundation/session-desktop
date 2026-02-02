import { hexColorToRGB } from '../util/hexColorToRGB';
import { COLORS, THEMES } from './constants/colors';
import { ThemeColorVariables } from './variableColors';

export const classicDark: ThemeColorVariables = {
  '--danger-color': THEMES.CLASSIC_DARK.DANGER,
  '--warning-color': THEMES.CLASSIC_DARK.WARNING,
  '--disabled-color': THEMES.CLASSIC_DARK.DISABLED,

  '--background-primary-color': THEMES.CLASSIC_DARK.COLOR1,
  '--background-secondary-color': THEMES.CLASSIC_DARK.COLOR0,
  '--background-tertiary-color': THEMES.CLASSIC_DARK.COLOR2,

  '--text-primary-color': THEMES.CLASSIC_DARK.COLOR6,
  '--text-secondary-color': THEMES.CLASSIC_DARK.COLOR5,
  '--text-selection-color': `rgba(${hexColorToRGB(THEMES.CLASSIC_DARK.COLOR6)}, 0.5)`,

  '--borders-color': THEMES.CLASSIC_DARK.COLOR3,

  '--message-bubble-outgoing-background-color': 'var(--primary-color)',
  '--message-bubble-incoming-background-color': THEMES.CLASSIC_DARK.COLOR2,
  '--message-bubble-outgoing-text-color': 'var(--background-primary-color)',
  '--message-bubble-incoming-text-color': 'var(--text-primary-color)',

  '--menu-button-background-hover-color': 'var(--primary-color)',
  '--menu-button-icon-color': 'var(--primary-color)',
  '--menu-button-icon-hover-color': 'var(--text-primary-color)',
  '--menu-button-border-color': 'var(--primary-color)',
  '--menu-button-border-hover-color': 'var(--primary-color)',

  '--chat-buttons-background-color': THEMES.CLASSIC_DARK.COLOR2,
  '--chat-buttons-background-hover-color': THEMES.CLASSIC_DARK.COLOR3,
  '--chat-buttons-icon-color': 'var(--text-primary-color)',

  '--button-outline-background-color': 'var(--transparent-color)',
  '--button-outline-background-hover-color': 'var(--text-primary-color)',
  '--button-outline-text-color': 'var(--text-primary-color)',
  '--button-outline-text-hover-color': 'var(--black-color)',
  '--button-outline-border-color': 'var(--text-primary-color)',
  '--button-outline-border-hover-color': 'var(--text-primary-color)',

  '--button-solid-background-hover-color': 'var(--transparent-color)',
  '--button-solid-text-hover-color': 'var(--text-primary-color)',

  '--button-simple-text-color': 'var(--text-primary-color)',

  '--button-icon-background-color': 'var(--transparent-color)',
  '--button-icon-stroke-hover-color': 'var(--text-primary-color)',
  '--button-icon-stroke-selected-color': 'var(--text-primary-color)',

  '--conversation-tab-background-color': 'var(--background-primary-color)',
  '--conversation-tab-background-hover-color': THEMES.CLASSIC_DARK.COLOR3,
  '--conversation-tab-background-selected-color': THEMES.CLASSIC_DARK.COLOR3,
  '--conversation-tab-background-unread-color': THEMES.CLASSIC_DARK.COLOR2,
  '--conversation-tab-text-selected-color': 'var(--text-primary-color)',
  '--conversation-tab-text-unread-color': 'var(--text-primary-color)',

  '--search-bar-background-color': 'var(--background-secondary-color)',

  '--scroll-bar-track-color': `rgba(${hexColorToRGB(THEMES.CLASSIC_DARK.COLOR5)}, 0.10)`,
  '--scroll-bar-track-hover-color': `rgba(${hexColorToRGB(THEMES.CLASSIC_DARK.COLOR5)}, 0.20)`,
  '--scroll-bar-thumb-color': `rgba(${hexColorToRGB(THEMES.CLASSIC_DARK.COLOR5)}, 0.20)`,
  '--scroll-bar-thumb-hover-color': `rgba(${hexColorToRGB(THEMES.CLASSIC_DARK.COLOR5)}, 1.0)`,

  '--toggle-switch-ball-shadow-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.15)`,
  '--toggle-switch-off-border-color': 'var(--white-color)',

  '--emoji-reaction-bar-background-color': THEMES.CLASSIC_DARK.COLOR2,
  '--emoji-reaction-bar-icon-background-color': 'var(--background-secondary-color)',

  '--modal-background-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 0.5)`,
  '--modal-background-content-color': COLORS.NEARBLACK,
  '--modal-shadow-color': `rgba(${hexColorToRGB(COLORS.BLACK)}, 1.0)`,
  '--modal-drop-shadow': `0px 0px 34px 0px var(--modal-shadow-color)`,

  '--toast-background-color': 'var(--background-primary-color)',

  '--session-logo-text-light-filter': 'none',
  '--session-logo-text-current-filter': 'var(--session-logo-text-light-filter)',

  '--suggestions-background-color': THEMES.CLASSIC_DARK.COLOR2,
  '--suggestions-background-hover-color': THEMES.CLASSIC_DARK.COLOR3,

  '--input-text-color': 'var(--text-primary-color)',

  '--call-buttons-background-color': THEMES.CLASSIC_DARK.COLOR3,
  '--call-buttons-background-hover-color': THEMES.CLASSIC_DARK.COLOR4,
  '--call-buttons-background-disabled-color': THEMES.CLASSIC_DARK.COLOR2,
  '--call-buttons-action-background-color': 'var(--white-color)',
  '--call-buttons-action-background-hover-color': `rgba(${hexColorToRGB(COLORS.WHITE)}, 0.87)`,
  '--call-buttons-icon-color': 'var(--text-primary-color)',
  '--call-buttons-icon-disabled-color': 'var(--text-primary-color)',

  '--file-dropzone-border-color': 'var(--primary-color)',

  '--session-recording-pulse-color': hexColorToRGB(THEMES.CLASSIC_DARK.DANGER),

  '--renderer-span-primary-color': 'var(--primary-color)',
};
