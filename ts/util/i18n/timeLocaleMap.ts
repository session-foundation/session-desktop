import * as supportedByDateFns from 'date-fns/locale';

import { Locale } from 'date-fns';
import { CrowdinLocale, crowdinLocales } from '../../localization/constants';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type MappedToEnType = { [K in CrowdinLocale]: Locale };

/**
 * Map every locales supported by Crowdin to english first.
 * Then we overwrite those values with what we have support for from date-fns and what we need to overwrite
 */
const mappedToEn: MappedToEnType = crowdinLocales.reduce((acc, key) => {
  acc[key] = supportedByDateFns.enUS;
  return acc;
}, {} as MappedToEnType);

// Note: to find new mapping you can use:
// https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes

export const timeLocaleMap: Record<CrowdinLocale, Locale> = {
  ...mappedToEn,
  ...supportedByDateFns,
  en: supportedByDateFns.enUS,

  // then overwrite anything that we don't agree with or need to support specifically.
  'es-419': supportedByDateFns.es,
  fa: supportedByDateFns.faIR,
  fil: supportedByDateFns.fi,
  'hy-AM': supportedByDateFns.hy,
  kmr: supportedByDateFns.km, // Central khmer
  'pt-BR': supportedByDateFns.ptBR,
  'pt-PT': supportedByDateFns.pt,
  'zh-CN': supportedByDateFns.zhCN,
  'zh-TW': supportedByDateFns.zhTW,
};

export function getForcedEnglishTimeLocale() {
  return timeLocaleMap.en;
}
