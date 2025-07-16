import { CrowdinLocale } from './constants';
import type { I18nMethods } from './I18nMethods';
import { pluralsDictionary, simpleDictionary } from './locales';

type SimpleDictionary = typeof simpleDictionary;
type PluralDictionary = typeof pluralsDictionary;

export type SimpleLocalizerTokens = keyof SimpleDictionary;
type PluralLocalizerTokens = keyof PluralDictionary;

export type MergedLocalizerTokens = SimpleLocalizerTokens | PluralLocalizerTokens;

let localeInUse: CrowdinLocale = 'en';

type Logger = (message: string) => void;
let logger: Logger | undefined;

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

// Note: not using isUnitTest as we will eventually move the whole folder to its own
// package
function isRunningInMocha(): boolean {
  return typeof global.it === 'function';
}

export function setLogger(cb: Logger) {
  if (logger && !isRunningInMocha()) {
    // eslint-disable-next-line no-console
    console.debug('logger already initialized. overriding it');
  }
  logger = cb;
}

export function setLocaleInUse(crowdinLocale: CrowdinLocale) {
  localeInUse = crowdinLocale;
}

function log(message: Parameters<Logger>[0]) {
  if (!logger) {
    // eslint-disable-next-line no-console
    console.log('logger is not set');
    return;
  }
  logger(message);
}

export function isSimpleToken(token: string): token is SimpleLocalizerTokens {
  return token in simpleDictionary;
}

export function isPluralToken(token: string): token is PluralLocalizerTokens {
  return token in pluralsDictionary;
}

/**
 * This type extracts from a dictionary, the keys that have a property 'args' set (i.e. not undefined or never).
 */
type TokenWithArgs<Dict> = {
  [Key in keyof Dict]: Dict[Key] extends { args: undefined } | { args: never } ? never : Key;
}[keyof Dict];

type MergedTokenWithArgs = TokenWithArgs<SimpleDictionary> | TokenWithArgs<PluralDictionary>;

export function isTokenWithArgs(token: string): token is MergedTokenWithArgs {
  return (
    (isSimpleToken(token) && !isEmptyObject(simpleDictionary[token]?.args)) ||
    (isPluralToken(token) && !isEmptyObject(pluralsDictionary[token]?.args))
  );
}

type DynamicArgStr = 'string' | 'number';

export type LocalizerDictionary = SimpleDictionary;

type ArgsTypeStrToTypes<T extends DynamicArgStr> = T extends 'string'
  ? string
  : T extends 'number'
    ? number
    : never;

// those are still a string of the type "string" | "number" and not the typescript types themselves
type ArgsFromTokenStr<T extends MergedLocalizerTokens> = T extends SimpleLocalizerTokens
  ? SimpleDictionary[T] extends { args: infer A }
    ? A extends Record<string, any>
      ? A
      : never
    : never
  : T extends PluralLocalizerTokens
    ? PluralDictionary[T] extends { args: infer A }
      ? A extends Record<string, any>
        ? A
        : never
      : never
    : never;

export type ArgsFromToken<T extends MergedLocalizerTokens> = MappedToTsTypes<ArgsFromTokenStr<T>>;

type ArgsFromTokenWithIcon<T extends MergedLocalizerTokens, I> = MappedToTsTypes<
  ArgsFromTokenStr<T>
> & { icon: I };

export function isArgsFromTokenWithIcon<T extends MergedLocalizerTokens, I extends string>(
  args: ArgsFromToken<T> | undefined
): args is ArgsFromTokenWithIcon<T, I> {
  return !!args && !isEmptyObject(args) && 'icon' in args && typeof args.icon === 'string';
}

/** The arguments for retrieving a localized message */
export type GetMessageArgs<T extends MergedLocalizerTokens> = T extends MergedLocalizerTokens
  ? T extends MergedTokenWithArgs
    ? [T, ArgsFromToken<T>]
    : [T]
  : never;

type MappedToTsTypes<T extends Record<string, DynamicArgStr>> = {
  [K in keyof T]: ArgsTypeStrToTypes<T[K]>;
};

function propsToTuple<T extends MergedLocalizerTokens>(
  opts: LocalizerComponentProps<T, string>
): GetMessageArgs<T> {
  return (
    isTokenWithArgs(opts.token) ? [opts.token, opts.args] : [opts.token]
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
  if (!isSimpleToken(token)) {
    throw new Error('inEnglish only supports simple strings for now');
  }
  const rawMessage = simpleDictionary[token].en;

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
  } catch (error) {
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
    const matchedArg = args ? args[arg as keyof typeof args] : undefined;

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
    if (
      typeof window !== 'undefined' &&
      window?.sessionFeatureFlags?.replaceLocalizedStringsWithKeys
    ) {
      return token;
    }

    if (isSimpleToken(token)) {
      return simpleDictionary[token][crowdinLocale];
    }
    if (!isPluralToken(token)) {
      throw new Error('invalid token, neither simple nor plural');
    }
    const pluralsObjects = pluralsDictionary[token];
    const localePluralsObject = pluralsObjects[crowdinLocale];

    if (!localePluralsObject || isEmptyObject(localePluralsObject)) {
      log(`Attempted to get translation for nonexistent key: '${token}'`);
      return token;
    }

    const num = args && 'count' in args ? args.count : 0;

    const cardinalRule = new Intl.PluralRules(crowdinLocale).select(num);

    const pluralString = getStringForRule({
      dictionary: pluralsDictionary,
      crowdinLocale,
      cardinalRule,
      token,
    });

    if (!pluralString) {
      log(`Plural string not found for cardinal '${cardinalRule}': '${pluralString}'`);
      return token;
    }

    return pluralString.replaceAll('#', `${num}`);
  } catch (error) {
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
  dictionary: PluralDictionary;
  token: PluralLocalizerTokens;
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
    } catch (error) {
      log(error);
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

      if (isSimpleToken(this.token)) {
        return simpleDictionary[this.token][this.localeToTarget()];
      }

      if (!isPluralToken(this.token)) {
        throw new Error(`invalid token provided: ${this.token}`);
      }

      return this.resolvePluralString();
    } catch (error) {
      log(error.message);
      return this.token;
    }
  }

  private resolvePluralString(): string {
    const pluralKey = 'count' as const;

    let num: number | string | undefined = this.args?.[pluralKey as keyof ArgsFromToken<T>];

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
      dictionary: pluralsDictionary,
      token: this.token,
    });

    if (!pluralString) {
      log(
        `Plural string not found for cardinal '${cardinalRule}': '${this.token}' Falling back to 'other' cardinal`
      );

      pluralString = getStringForRule({
        cardinalRule: 'other',
        crowdinLocale: localeToTarget,
        dictionary: pluralsDictionary,
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
      const matchedArg = this.args
        ? this.args[arg as keyof ArgsFromToken<T>]?.toString()
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

/** The props for the localization component */
export type LocalizerComponentProps<
  T extends MergedLocalizerTokens,
  I,
> = T extends MergedLocalizerTokens
  ? ArgsFromToken<T> extends never
    ? LocalizerComponentBaseProps<T> & { args?: undefined }
    : ArgsFromToken<T> extends Record<string, never>
      ? LocalizerComponentBaseProps<T> & { args?: undefined }
      : ArgsFromToken<T> extends { icon: string }
        ? LocalizerComponentBaseProps<T> & { args: ArgsFromTokenWithIcon<T, I> }
        : LocalizerComponentBaseProps<T> & {
            args: ArgsFromToken<T>;
          }
  : never;
