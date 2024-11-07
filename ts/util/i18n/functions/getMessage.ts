/** NOTE: Because of docstring limitations changes MUST be manually synced between {@link setupI18n.getMessage } and {@link window.i18n } */

import type {
  LocalizerToken,
  LocalizerDictionary,
  GetMessageArgs,
  SetupI18nReturnType,
} from '../../../types/localizer';
import { i18nLog } from '../shared';
import { formatMessageWithArgs } from './formatMessageWithArgs';
import { getRawMessage } from './getRawMessage';
import { inEnglish } from './inEnglish';
import { stripped } from './stripped';
import { localizeFromOld, type StringArgsRecord } from '../localizedString';

/**
 * Retrieves a localized message string, substituting variables where necessary.
 *
 * @param token - The token identifying the message to retrieve.
 * @param args - An optional record of substitution variables and their replacement values. This is required if the string has dynamic variables.
 *
 * @returns The localized message string with substitutions applied.
 *
 * @example
 * // The string greeting is 'Hello, {name}!' in the current locale
 * window.i18n('greeting', { name: 'Alice' });
 * // => 'Hello, Alice!'
 *
 * // The string search is '{count, plural, one [{found_count} of # match] other [{found_count} of # matches]}' in the current locale
 * window.i18n('search', { count: 1, found_count: 1 });
 * // => '1 of 1 match'
 */
function getMessageDefault<T extends LocalizerToken, R extends LocalizerDictionary[T]>(
  ...[token, args]: GetMessageArgs<T>
): R | T {
  try {
    return localizeFromOld<T>(token as T, args as StringArgsRecord<R>).toString() as T | R;
  } catch (error) {
    i18nLog(error.message);
    return token as R;
  }
}

getMessageDefault.inEnglish = inEnglish;
getMessageDefault.stripped = stripped;
getMessageDefault.getRawMessage = getRawMessage;
getMessageDefault.formatMessageWithArgs = formatMessageWithArgs;

export const getMessage: SetupI18nReturnType = getMessageDefault as SetupI18nReturnType;
