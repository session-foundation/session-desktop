import type { CrowdinLocale } from './constants';
import type {
  MergedLocalizerTokens,
  GetMessageArgs,
  LocalizerComponentProps,
  SimpleLocalizerTokens,
  ArgsFromToken,
} from './localeTools';

export type I18nMethods = {
  /** @see {@link window.i18n.stripped} */
  stripped: <T extends MergedLocalizerTokens>(...[token, args]: GetMessageArgs<T>) => string | T;
  strippedWithObj: <T extends MergedLocalizerTokens>(
    opts: LocalizerComponentProps<T, string>
  ) => string | T;
  /** @see {@link window.i18n.inEnglish} */
  inEnglish: <T extends SimpleLocalizerTokens>(token: T) => string | T;
  /** @see {@link window.i18n.formatMessageWithArgs */
  getRawMessage: <T extends MergedLocalizerTokens>(
    crowdinLocale: CrowdinLocale,
    ...[token, args]: GetMessageArgs<T>
  ) => string | T;
  /** @see {@link window.i18n.formatMessageWithArgs} */
  formatMessageWithArgs: <T extends MergedLocalizerTokens>(
    rawMessage: string,
    args?: ArgsFromToken<T>
  ) => string | T;
};
