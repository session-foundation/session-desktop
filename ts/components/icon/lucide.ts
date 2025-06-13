export enum LUCIDE_ICONS_UNICODE {
  AT_SIGN = '',
  BAN = '',
  BUG = '',
  CHECK = '',
  CHECK_CHECK = '',
  CHEVRON_LEFT = '',
  CHEVRON_RIGHT = '',
  CIRCLE_ARROW_DOWN = '',
  CIRCLE_CHECK = '',
  CIRCLE_ELLIPSES = '',
  CIRCLE_HELP = '',
  COPY = '',
  EYE = '',
  EYE_OFF = '',
  EXTERNAL_LINK_ICON = '',
  FILE = '',
  GLOBE = '',
  HEART = '',
  INFO = '',
  LOCK_KEYHOLE = '',
  LOG_OUT = '',
  MESSAGE_SQUARE = '',
  MESSAGE_SQUARE_WARNING = '',
  MOON = '',
  OCTAGON_ALERT = '',
  OCTAGON_X = '',
  PAINTBRUSH_VERTICAL = '',
  PENCIL = '',
  PIN = '',
  PIN_OFF = '',
  PLUS = '',
  PHONE = '',
  REFRESH_CW = '',
  REPLY = '',
  SEARCH = '',
  SETTINGS = '',
  SQUARE_CODE = '',
  SUN_MEDIUM = '',
  TIMER = '',
  TRASH2 = '',
  USER_ROUND = '',
  USER_ROUND_CHECK = '',
  USER_ROUND_PEN = '',
  USER_ROUND_PLUS = '',
  USER_ROUND_X = '',
  USERS_ROUND = '',
  VOLUME_2 = '',
  VOLUME_OFF = '',
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
