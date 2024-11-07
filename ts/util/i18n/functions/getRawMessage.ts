/** NOTE: Because of docstring limitations changes MUST be manually synced between {@link setupI18n.getRawMessage } and {@link window.i18n.getRawMessage } */

import { en } from '../../../localization/locales';
import type {
  DictionaryWithoutPluralStrings,
  GetMessageArgs,
  LocalizerToken,
  PluralKey,
  PluralString,
} from '../../../types/localizer';
import {
  getTranslationDictionary,
  getStringForCardinalRule,
  i18nLog,
  getCrowdinLocale,
} from '../shared';

function getPluralKey<R extends PluralKey | undefined>(string: PluralString): R {
  const match = /{(\w+), plural, one \[.+\] other \[.+\]}/g.exec(string);
  return (match?.[1] ?? undefined) as R;
}

const isPluralForm = (localizedString: string): localizedString is PluralString =>
  /{\w+, plural, one \[.+\] other \[.+\]}/g.test(localizedString);

/**
 * Retrieves a localized message string, without substituting any variables. This resolves any plural forms using the given args
 * @param token - The token identifying the message to retrieve.
 * @param args - An optional record of substitution variables and their replacement values. This is required if the string has dynamic variables.
 *
 * @returns The localized message string with substitutions applied.
 *
 * NOTE: This is intended to be used to get the raw string then format it with {@link formatMessageWithArgs}
 *
 * @example
 * // The string greeting is 'Hello, {name}!' in the current locale
 * window.i18n.getRawMessage('greeting', { name: 'Alice' });
 * // => 'Hello, {name}!'
 *
 * // The string search is '{count, plural, one [{found_count} of # match] other [{found_count} of # matches]}' in the current locale
 * window.i18n.getRawMessage('search', { count: 1, found_count: 1 });
 * // => '{found_count} of {count} match'
 */
export function getRawMessage<
  T extends LocalizerToken,
  R extends DictionaryWithoutPluralStrings[T],
>(...[token, args]: GetMessageArgs<T>): R | T {
  try {
    if (
      typeof window !== 'undefined' &&
      window?.sessionFeatureFlags?.replaceLocalizedStringsWithKeys
    ) {
      return token as T;
    }

    const localizedDictionary = getTranslationDictionary();

    let localizedString = localizedDictionary[token] as R;

    if (!localizedString) {
      i18nLog(`Attempted to get translation for nonexistent key: '${token}'`);

      localizedString = en[token] as R;

      if (!localizedString) {
        i18nLog(
          `Attempted to get translation for nonexistent key: '${token}' in fallback dictionary`
        );
        return token as T;
      }
    }

    /** If a localized string does not have any arguments to substitute it is returned with no
     * changes. We also need to check if the string contains a curly bracket as if it does
     * there might be a default arg */
    if (!args && !localizedString.includes('{')) {
      return localizedString;
    }

    if (isPluralForm(localizedString)) {
      const pluralKey = getPluralKey(localizedString);

      if (!pluralKey) {
        i18nLog(`Attempted to nonexistent pluralKey for plural form string '${localizedString}'`);
      } else {
        const num = args?.[pluralKey as keyof typeof args] ?? 0;

        const currentLocale = getCrowdinLocale();
        const cardinalRule = new Intl.PluralRules(currentLocale).select(num);

        const pluralString = getStringForCardinalRule(localizedString, cardinalRule);

        if (!pluralString) {
          i18nLog(`Plural string not found for cardinal '${cardinalRule}': '${localizedString}'`);
          return token as T;
        }

        localizedString = pluralString.replaceAll('#', `${num}`) as R;
      }
    }
    return localizedString;
  } catch (error) {
    i18nLog(error.message);
    return token as T;
  }
}
