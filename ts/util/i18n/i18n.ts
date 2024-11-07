// this file is a weird one as it is used by both sides of electron at the same time

import { isEmpty } from 'lodash';
import type { LocalizerDictionary, SetupI18nReturnType } from '../../types/localizer';
import { getMessage } from './functions/getMessage';
import { i18nLog, setInitialLocale } from './shared';
import { CrowdinLocale } from '../../localization/constants';

/**
 * Sets up the i18n function with the provided locale and messages.
 *
 * @param params - An object containing optional parameters.
 * @param params.crowdinLocale - The locale to use for translations (crowdin)
 * @param params.translationDictionary - A dictionary of localized messages
 *
 * @returns A function that retrieves a localized message string, substituting variables where necessary.
 */
export const setupI18n = ({
  crowdinLocale,
  translationDictionary,
}: {
  crowdinLocale: CrowdinLocale;
  translationDictionary: LocalizerDictionary;
}): SetupI18nReturnType => {
  if (!crowdinLocale) {
    throw new Error(`crowdinLocale not provided in i18n setup`);
  }

  if (!translationDictionary || isEmpty(translationDictionary)) {
    throw new Error('translationDictionary was not provided');
  }

  setInitialLocale(crowdinLocale, translationDictionary);

  i18nLog(`Setup Complete with crowdinLocale: ${crowdinLocale}`);

  return getMessage;
};
