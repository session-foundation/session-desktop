// this file is a weird one as it is used by both sides of electron at the same time

import { i18nLog, setInitialLocale } from './shared';
import { type CrowdinLocale, setLocaleInUse, setLogger } from '../../localization';
import { isUnitTest } from '../../shared/env_vars';

/**
 * Sets up the i18n function with the provided locale and messages.
 *
 * @param params - An object containing optional parameters.
 * @param params.crowdinLocale - The locale to use for translations (crowdin)
 *
 * @returns A function that retrieves a localized message string, substituting variables where necessary.
 */
export const setupI18n = ({ crowdinLocale }: { crowdinLocale: CrowdinLocale }) => {
  if (!crowdinLocale) {
    throw new Error(`crowdinLocale not provided in i18n setup`);
  }

  setInitialLocale(crowdinLocale);

  if (!isUnitTest()) {
    // eslint-disable-next-line no-console
    console.log(`Setup Complete with crowdinLocale: ${crowdinLocale}`);
  }
  setLogger(i18nLog);
  setLocaleInUse(crowdinLocale);
};
