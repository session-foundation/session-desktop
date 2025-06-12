export enum LUCIDE_ICONS_UNICODE {
  EXTERNAL_LINK_ICON = '',
  COPY = '',
  REPLY = '',
  REFRESH_CW = '',
  CIRCLE_ARROW_DOWN = '',
  TRASH2 = '',
  LOG_OUT = '',
  AT_SIGN = '',
  VOLUME_OFF = '',
  VOLUME_2 = '',
  BUG = '',
  TIMER = '',
  USER_ROUND = '',
  USER_ROUND_PEN = '',
  USER_ROUND_PLUS = '',
  FILE = '',
  PIN = '',
  PIN_OFF = '',
  BAN = '',
  EYE_OFF = '',
  USER_ROUND_X = '',
  USER_ROUND_CHECK = '',
  PENCIL = '',
  SEARCH = '',
  CHEVRON_LEFT = '',
  X = '',
}

/**
 * Used for rendering icons inside of the Localizer component
 * @note Current: Lucide v0.488.0
 * @note The Lucide Icon font must be installed locally to see these icons.
 * @note Download from https://github.com/lucide-icons/lucide/releases
 */
export const LUCIDE_INLINE_ICONS = {
  EXTERNAL_LINK_ICON: `<span role='img' aria-label='external link icon'>${LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON}</span>`,
};

export type LucideInlineIconKeys = keyof typeof LUCIDE_INLINE_ICONS;
