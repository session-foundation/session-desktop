import type { MergedLocalizerTokens, GetMessageArgs } from '../localization/localeTools';
import type { I18nMethods } from './I18nMethods';

export type SetupI18nReturnType = I18nMethods &
  (<T extends MergedLocalizerTokens>(...[token, args]: GetMessageArgs<T>) => string);
