import type { SetupI18nReturnType } from '../types/localizer';
import { setupI18n } from '../util/i18n/i18n';
import { CrowdinLocale, isCrowdinLocale } from '../localization/constants';

export function normalizeLocaleName(locale: string) {
  const dashedLocale = locale.replaceAll('_', '-');

  // Note: this is a pain, but we somehow needs to keep in sync this logic and the LOCALE_PATH_MAPPING from
  // https://github.com/session-foundation/session-shared-scripts/blob/main/crowdin/generate_desktop_strings.py
  // What we do, is keep as is, anything given in LOCALE_PATH_MAPPING, but otherwise, keep only the first part of the locale.
  // So `es-419` is allowed, but `es-es` is hardcoded to es, fr_FR is hardcoded to fr, and so on.
  if (
    /^es-419/.test(dashedLocale) ||
    /^hy-AM/.test(dashedLocale) ||
    /^kmr-TR/.test(dashedLocale) ||
    /^pt-BR/.test(dashedLocale) ||
    /^pt-PT/.test(dashedLocale) ||
    /^zh-CN/.test(dashedLocale) ||
    /^zh-TW/.test(dashedLocale)
  ) {
    return dashedLocale;
  }
  const firstDash = dashedLocale.indexOf('-');
  if (firstDash > 0) {
    return dashedLocale.slice(0, firstDash);
  }
  return dashedLocale;
}

function resolveLocale(crowdinLocale: string): CrowdinLocale {
  const locale = normalizeLocaleName(crowdinLocale);
  if (isCrowdinLocale(locale)) {
    return locale;
  }
  console.error(`Invalid locale: ${locale} falling back to en`);
  return 'en' as CrowdinLocale;
}

export function loadLocalizedDictionary({ appLocale }: { appLocale: string }): {
  crowdinLocale: CrowdinLocale;
  i18n: SetupI18nReturnType;
} {
  if (!appLocale) {
    throw new TypeError('`appLocale` is required');
  }

  // Load locale - if we can't load messages for the current locale, we
  // default to 'en'
  //
  // possible locales:
  // https://github.com/electron/electron/blob/master/docs/api/locales.md
  const crowdinLocale = resolveLocale(appLocale);

  const i18n = setupI18n({
    crowdinLocale,
  });

  return {
    crowdinLocale,
    i18n,
  };
}
