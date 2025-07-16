import type { I18nMethods } from '../localization/I18nMethods';
import type { MergedLocalizerTokens, GetMessageArgs } from '../localization/localeTools';

export type SetupI18nReturnType = I18nMethods &
  (<T extends MergedLocalizerTokens>(...[token, args]: GetMessageArgs<T>) => string);
