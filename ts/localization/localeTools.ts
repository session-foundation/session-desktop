import { CrowdinLocale } from './constants';
import type { I18nMethods } from './I18nMethods';
import {
  pluralsDictionaryWithArgs,
  simpleDictionaryNoArgs,
  simpleDictionaryWithArgs,
  type TokenPluralWithArgs,
  type TokenSimpleNoArgs,
  type TokenSimpleWithArgs,
  type TokensPluralAndArgs,
  type TokensSimpleAndArgs,
} from './locales';

// eslint-disable-next-line no-console
const SubLogger = { info: console.log };

export function setLogger(logger: (msg: string) => void) {
  SubLogger.info = logger;
}

/**
 * The tokens that always have an arg
 */
type MergedTokenWithArgs = TokenSimpleWithArgs | TokenPluralWithArgs;

/**
 * Those are all of the tokens we can use in the localizer, with or without args, plurals or not.
 */
export type MergedLocalizerTokens = TokenSimpleNoArgs | MergedTokenWithArgs;

let localeInUse: CrowdinLocale = 'en';

/**
 * Simpler than lodash. Duplicated to avoid having to import lodash in the file.
 * Because we share it with QA, but also to have a self contained localized tool that we can copy/paste
 */
function isEmptyObject(obj: unknown) {
  if (!obj) {
    return true;
  }
  if (typeof obj !== 'object') {
    return false;
  }
  return Object.keys(obj).length === 0;
}

function isRunningInMocha(): boolean {
  return typeof (global as any).it === 'function';
}

export function setLocaleInUse(crowdinLocale: CrowdinLocale) {
  localeInUse = crowdinLocale;
}

function log(message: string) {
  if (isRunningInMocha()) {
    return;
  }
  SubLogger.info(message);
}

export function isSimpleTokenNoArgs(token: string): token is TokenSimpleNoArgs {
  return token in simpleDictionaryNoArgs;
}

export function isSimpleTokenWithArgs(token: string): token is TokenSimpleWithArgs {
  return token in simpleDictionaryWithArgs;
}

export function isPluralToken(token: string): token is TokenPluralWithArgs {
  return token in pluralsDictionaryWithArgs;
}

export function isTokenWithArgs(token: string): token is MergedTokenWithArgs {
  return isSimpleTokenWithArgs(token) || isPluralToken(token);
}

type PluralDictionaryWithArgs = typeof pluralsDictionaryWithArgs;

// those are still a string of the type "string" | "number" and not the typescript types themselves
type ArgsFromTokenStr<T extends MergedTokenWithArgs> = T extends keyof TokensSimpleAndArgs
  ? TokensSimpleAndArgs[T]
  : T extends keyof TokensPluralAndArgs
    ? TokensPluralAndArgs[T]
    : never;

export type ArgsFromToken<T extends MergedLocalizerTokens> = T extends MergedTokenWithArgs
  ? ArgsFromTokenStr<T>
  : undefined;

/** The arguments for retrieving a localized message */
export type GetMessageArgs<T extends MergedLocalizerTokens> = T extends MergedLocalizerTokens
  ? T extends MergedTokenWithArgs
    ? [T, ArgsFromToken<T>]
    : [T]
  : never;

function propsToTuple<T extends MergedLocalizerTokens>(
  opts: LocalizerComponentProps<T>
): GetMessageArgs<T> {
  return (
    isLocalizerComponentBaseProps(opts) ? [opts.token, opts.args] : [opts.token]
  ) as GetMessageArgs<T>;
}

/** NOTE: Because of docstring limitations changes MUST be manually synced between {@link setupI18n.inEnglish } and {@link window.i18n.inEnglish } */
/**
 * Retrieves a message string in the {@link en} locale, substituting variables where necessary.
 *
 * NOTE: This does not work for plural strings. This function should only be used for debug and
 * non-user-facing strings. Plural string support can be added splitting out the logic for
 * {@link setupI18n.formatMessageWithArgs} and creating a new getMessageFromDictionary, which
 * specifies takes a dictionary as an argument. This is left as an exercise for the reader.
 * @deprecated this will eventually be replaced by LocalizedStringBuilder
 *
 * @param token - The token identifying the message to retrieve.
 * @param args - An optional record of substitution variables and their replacement values. This is required if the string has dynamic variables.
 */
export const inEnglish: I18nMethods['inEnglish'] = token => {
  if (!isSimpleTokenNoArgs(token)) {
    throw new Error('inEnglish only supports simple strings for now');
  }
  const rawMessage = simpleDictionaryNoArgs[token].en;

  if (!rawMessage) {
    log(`Attempted to get forced en string for nonexistent key: '${token}' in fallback dictionary`);
    return token;
  }
  return formatMessageWithArgs(rawMessage);
};

/**
 * Retrieves a localized message string, substituting variables where necessary.
 *
 * @param token - The token identifying the message to retrieve.
 * @param args - An optional record of substitution variables and their replacement values. This is required if the string has dynamic variables.
 *
 * @returns The localized message string with substitutions applied.
 */
export function getMessageDefault<T extends MergedLocalizerTokens>(
  ...props: GetMessageArgs<T>
): string {
  const token = props[0];
  try {
    return localizeFromOld(props[0], props[1] as ArgsFromToken<T>).toString();
  } catch (error: any) {
    log(error.message);
    return token;
  }
}

/**
 * Retrieves a localized message string, substituting variables where necessary. Then strips the message of any HTML and custom tags.
 *
 * @deprecated This will eventually be replaced altogether by LocalizedStringBuilder
 *
 * @param token - The token identifying the message to retrieve.
 * @param args - An optional record of substitution variables and their replacement values. This is required if the string has dynamic variables.
 *
 * @returns The localized message string with substitutions applied. Any HTML and custom tags are removed.
 */
export const stripped: I18nMethods['stripped'] = (...[token, args]) => {
  const sanitizedArgs = args ? sanitizeArgs(args, '\u200B') : undefined;

  // Note: the `as any` is needed because we don't have the <T> template argument available
  // when enforcing the type of the stripped function to be the one defined by I18nMethods
  const i18nString = getMessageDefault(...([token, sanitizedArgs] as GetMessageArgs<any>));

  const strippedString = i18nString.replaceAll(/<[^>]*>/g, '');

  return deSanitizeHtmlTags(strippedString, '\u200B');
};

export const strippedWithObj: I18nMethods['strippedWithObj'] = opts => {
  return stripped(...propsToTuple(opts));
};

/**
 * Sanitizes the args to be used in the i18n function
 * @param args The args to sanitize
 * @param identifier The identifier to use for the args. Use this if you want to de-sanitize the args later.
 * @returns The sanitized args
 */
export function sanitizeArgs(
  args: Record<string, string | number>,
  identifier?: string
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => [
      key,
      typeof value === 'string' ? sanitizeHtmlTags(value, identifier) : value,
    ])
  );
}

/**
 * Formats a localized message string with arguments and returns the formatted string.
 * @param rawMessage - The raw message string to format. After using @see {@link getRawMessage} to get the raw string.
 * @param args - An optional record of substitution variables and their replacement values. This
 * is required if the string has dynamic variables. This can be optional as a strings args may be defined in @see {@link LOCALE_DEFAULTS}
 *
 * @returns The formatted message string.
 *
 * @deprecated
 *
 */
export const formatMessageWithArgs: I18nMethods['formatMessageWithArgs'] = (rawMessage, args) => {
  /** Find and replace the dynamic variables in a localized string and substitute the variables with the provided values */
  return rawMessage.replace(/\{(\w+)\}/g, (match: any, arg: string) => {
    const matchedArg = args ? (args as Record<string, any>)[arg] : undefined;

    return matchedArg?.toString() ?? match;
  });
};

/**
 * Retrieves a localized message string, without substituting any variables. This resolves any plural forms using the given args
 * @param token - The token identifying the message to retrieve.
 * @param args - An optional record of substitution variables and their replacement values. This is required if the string has dynamic variables.
 *
 * @returns The localized message string with substitutions applied.
 *
 * NOTE: This is intended to be used to get the raw string then format it with {@link formatMessageWithArgs}
 */
export const getRawMessage: I18nMethods['getRawMessage'] = (crowdinLocale, ...[token, args]) => {
  try {
    if (isSimpleTokenNoArgs(token)) {
      return simpleDictionaryNoArgs[token][crowdinLocale];
    }
    if (isSimpleTokenWithArgs(token)) {
      return simpleDictionaryWithArgs[token][crowdinLocale];
    }
    if (!isPluralToken(token)) {
      throw new Error('invalid token, neither simple nor plural');
    }
    const pluralsObjects = pluralsDictionaryWithArgs[token];
    const localePluralsObject = pluralsObjects[crowdinLocale];

    if (!localePluralsObject || isEmptyObject(localePluralsObject)) {
      log(`Attempted to get translation for nonexistent key: '${token}'`);
      return token;
    }

    const num = args && 'count' in args ? args.count : 0;

    const cardinalRule = new Intl.PluralRules(crowdinLocale).select(num);

    const pluralString = getStringForRule({
      dictionary: pluralsDictionaryWithArgs,
      crowdinLocale,
      cardinalRule,
      token,
    });

    if (!pluralString) {
      log(`Plural string not found for cardinal '${cardinalRule}': '${pluralString}'`);
      return token;
    }

    return pluralString.replaceAll('#', `${num}`);
  } catch (error: any) {
    log(error.message);
    return token;
  }
};

function getStringForRule({
  dictionary,
  token,
  crowdinLocale,
  cardinalRule,
}: {
  dictionary: PluralDictionaryWithArgs;
  token: TokenPluralWithArgs;
  crowdinLocale: CrowdinLocale;
  cardinalRule: Intl.LDMLPluralRule;
}) {
  const dictForLocale = dictionary[token][crowdinLocale];
  return cardinalRule in dictForLocale ? ((dictForLocale as any)[cardinalRule] as string) : token;
}

/**
 * Replaces all html tag identifiers with their escaped equivalents
 * @param str The string to sanitize
 * @param identifier The identifier to use for the args. Use this if you want to de-sanitize the args later.
 * @returns The sanitized string
 */
function sanitizeHtmlTags(str: string, identifier: string = ''): string {
  if (identifier && /[a-zA-Z0-9></\\\-\s]+/g.test(identifier)) {
    throw new Error('Identifier is not valid');
  }

  return str
    .replace(/&/g, `${identifier}&amp;${identifier}`)
    .replace(/</g, `${identifier}&lt;${identifier}`)
    .replace(/>/g, `${identifier}&gt;${identifier}`);
}

/**
 * Replaces all sanitized html tags with their real equivalents
 * @param str The string to de-sanitize
 * @param identifier The identifier used when the args were sanitized
 * @returns The de-sanitized string
 */
function deSanitizeHtmlTags(str: string, identifier: string): string {
  if (!identifier || /[a-zA-Z0-9></\\\-\s]+/g.test(identifier)) {
    throw new Error('Identifier is not valid');
  }

  return str
    .replace(new RegExp(`${identifier}&amp;${identifier}`, 'g'), '&')
    .replace(new RegExp(`${identifier}&lt;${identifier}`, 'g'), '<')
    .replace(new RegExp(`${identifier}&gt;${identifier}`, 'g'), '>');
}

class LocalizedStringBuilder<T extends MergedLocalizerTokens> extends String {
  private readonly token: T;
  private args?: ArgsFromToken<T>;
  private isStripped = false;
  private isEnglishForced = false;
  private crowdinLocale: CrowdinLocale;

  private readonly renderStringAsToken: boolean;

  constructor(token: T, crowdinLocale: CrowdinLocale, renderStringAsToken?: boolean) {
    super(token);
    this.token = token;
    this.crowdinLocale = crowdinLocale;
    this.renderStringAsToken = renderStringAsToken || false;
  }

  public toString(): string {
    try {
      if (this.renderStringAsToken) {
        return this.token;
      }

      const rawString = this.getRawString();
      const str = this.formatStringWithArgs(rawString);

      if (this.isStripped) {
        return this.postProcessStrippedString(str);
      }

      return str;
    } catch (error: any) {
      log(error.message);
      return this.token;
    }
  }

  withArgs(args: ArgsFromToken<T>): Omit<this, 'withArgs'> {
    this.args = args;
    return this;
  }

  forceEnglish(): Omit<this, 'forceEnglish'> {
    this.isEnglishForced = true;
    return this;
  }

  strip(): Omit<this, 'strip'> {
    const sanitizedArgs = this.args ? sanitizeArgs(this.args, '\u200B') : undefined;
    if (sanitizedArgs) {
      this.args = sanitizedArgs as ArgsFromToken<T>;
    }
    this.isStripped = true;

    return this;
  }

  private postProcessStrippedString(str: string): string {
    const strippedString = str.replaceAll(/<[^>]*>/g, '');
    return deSanitizeHtmlTags(strippedString, '\u200B');
  }

  private localeToTarget(): CrowdinLocale {
    return this.isEnglishForced ? 'en' : this.crowdinLocale;
  }

  private getRawString(): string {
    try {
      if (this.renderStringAsToken) {
        return this.token;
      }

      if (isSimpleTokenNoArgs(this.token)) {
        return simpleDictionaryNoArgs[this.token][this.localeToTarget()];
      }
      if (isSimpleTokenWithArgs(this.token)) {
        return simpleDictionaryWithArgs[this.token][this.localeToTarget()];
      }

      if (!isPluralToken(this.token)) {
        throw new Error('invalid token provided');
      }

      return this.resolvePluralString();
    } catch (error: any) {
      log(error.message);
      return this.token;
    }
  }

  private resolvePluralString(): string {
    const pluralKey = 'count' as const;

    let num: number | string | undefined;
    if (this.args && pluralKey in this.args) {
      num = this.args[pluralKey];
    }

    if (num === undefined) {
      log(
        `Attempted to get plural count for missing argument '${pluralKey} for token '${this.token}'`
      );
      num = 0;
    }

    if (typeof num !== 'number') {
      log(
        `Attempted to get plural count for argument '${pluralKey}' which is not a number for token '${this.token}'`
      );
      num = parseInt(num, 10);
      if (Number.isNaN(num)) {
        log(
          `Attempted to get parsed plural count for argument '${pluralKey}' which is not a number for token '${this.token}'`
        );
        num = 0;
      }
    }

    const localeToTarget = this.localeToTarget();
    const cardinalRule = new Intl.PluralRules(localeToTarget).select(num);

    if (!isPluralToken(this.token)) {
      throw new Error('resolvePluralString can only be called with a plural string');
    }

    let pluralString = getStringForRule({
      cardinalRule,
      crowdinLocale: localeToTarget,
      dictionary: pluralsDictionaryWithArgs,
      token: this.token,
    });

    if (!pluralString) {
      log(
        `Plural string not found for cardinal '${cardinalRule}': '${this.token}' Falling back to 'other' cardinal`
      );

      pluralString = getStringForRule({
        cardinalRule: 'other',
        crowdinLocale: localeToTarget,
        dictionary: pluralsDictionaryWithArgs,
        token: this.token,
      });

      if (!pluralString) {
        log(`Plural string not found for fallback cardinal 'other': '${this.token}'`);

        return this.token;
      }
    }

    return pluralString.replaceAll('#', `${num}`);
  }

  private formatStringWithArgs(str: string): string {
    /** Find and replace the dynamic variables in a localized string and substitute the variables with the provided values */
    return str.replace(/\{(\w+)\}/g, (match, arg: string) => {
      const matchedArg =
        this.args && arg in this.args
          ? (this.args as Record<string, unknown>)[arg]?.toString()
          : undefined;

      return matchedArg ?? match;
    });
  }
}

export function localize<T extends MergedLocalizerTokens>(token: T) {
  return new LocalizedStringBuilder<T>(token, localeInUse);
}

export function localizeFromOld<T extends MergedLocalizerTokens>(token: T, args: ArgsFromToken<T>) {
  return localize(token).withArgs(args);
}

export type LocalizerHtmlTag = 'span' | 'div';
/** Basic props for all calls of the Localizer component */
type LocalizerComponentBaseProps<T extends MergedLocalizerTokens> = {
  token: T;
  asTag?: LocalizerHtmlTag;
  className?: string;
};

type LocalizerComponentBasePropsWithArgs<T extends MergedLocalizerTokens> =
  LocalizerComponentBaseProps<T> & { args: ArgsFromToken<T> };

function isLocalizerComponentBaseProps<T extends MergedLocalizerTokens>(
  props: LocalizerComponentBaseProps<T>
): props is LocalizerComponentBasePropsWithArgs<T> {
  return isTokenWithArgs(props.token);
}

/** The props for the localization component */
export type LocalizerComponentProps<T extends MergedLocalizerTokens> =
  T extends MergedLocalizerTokens
    ? T extends TokenSimpleNoArgs // no args needed for the simple token that are defined as having no args
      ? LocalizerComponentBaseProps<T>
      : T extends MergedTokenWithArgs
        ? LocalizerComponentBasePropsWithArgs<T>
        : never
    : never;

export type LocalizerComponentPropsObject = LocalizerComponentProps<MergedLocalizerTokens>;
