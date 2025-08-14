import { CrowdinLocale } from './constants';
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

// Note: those two functions are actually duplicates of Errors.toString.
// We should maybe make that a module that we reuse?
function withClause(error: unknown) {
  if (error && typeof error === 'object' && 'cause' in error) {
    return `\nCaused by: ${String(error.cause)}`;
  }
  return '';
}

function stringifyError(error: unknown): string {
  if (error instanceof Error && error.stack) {
    return error.stack + withClause(error);
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message) + withClause(error);
  }
  return String(error) + withClause(error);
}

/**
 * Duplicated from lodash, as we want the files under ts/localization to be self contained.
 */
function omit<T extends object, K extends keyof T>(obj: T, keys: Array<K>): Omit<T, K> {
  const entries = Object.entries(obj) as Array<[K, T[K]]>;
  const filteredEntries = entries.filter(([key]) => !keys.includes(key));
  return Object.fromEntries(filteredEntries) as unknown as Omit<T, K>;
}
// eslint-disable-next-line no-console
const SubLogger = { info: console.log };

export function setLogger(logger: (msg: string) => void) {
  SubLogger.info = logger;
}

/**
 * The tokens that always have an arg
 */
type MergedTokenWithArgs = TokenPluralWithArgs | TokenSimpleWithArgs;

/**
 * Those are all of the tokens we can use in the localizer, with or without args, plurals or not.
 */
export type MergedLocalizerTokens = MergedTokenWithArgs | TokenSimpleNoArgs;

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

// Note: not using isUnitTest as we will eventually move the whole folder to its own
// package
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

type ArgsFromTokenWithIcon<T extends MergedLocalizerTokens> = ArgsFromToken<T> & {
  icon: string;
};

export function isArgsFromTokenWithIcon<T extends MergedLocalizerTokens>(
  args: ArgsFromToken<T> | undefined
): args is ArgsFromTokenWithIcon<T> {
  return !!args && !isEmptyObject(args) && 'icon' in args;
}

type WithToken<T extends MergedLocalizerTokens> = { token: T };

/** The arguments for retrieving a localized message */
export type GetMessageArgs<T extends MergedLocalizerTokens> = T extends MergedLocalizerTokens
  ? T extends MergedTokenWithArgs
    ? WithToken<T> & ArgsFromToken<T>
    : WithToken<T>
  : never;

export type TrArgs = GetMessageArgs<MergedLocalizerTokens>;

export function tStrippedWithObj<T extends MergedLocalizerTokens>(opts: GetMessageArgs<T>): string {
  const builder = new LocalizedStringBuilder<T>(opts.token as T, localeInUse).stripIt();
  const args = messageArgsToArgsOnly(opts);
  if (args) {
    builder.withArgs(args);
  }
  return builder.toString();
}

/**
 * Sanitizes the args to be used in the i18n function
 * @param args The args to sanitize
 * @param identifier The identifier to use for the args. Use this if you want to de-sanitize the args later.
 * @returns The sanitized args
 */
export function sanitizeArgs(
  args: Record<string, number | string>,
  identifier?: string
): Record<string, number | string> {
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
export function formatMessageWithArgs<T extends MergedLocalizerTokens>(
  rawMessage: string,
  args?: ArgsFromToken<T>
): T | string {
  /** Find and replace the dynamic variables in a localized string and substitute the variables with the provided values */
  return rawMessage.replace(/\{(\w+)\}/g, (match: any, arg: string) => {
    const matchedArg = args ? (args as Record<string, any>)[arg] : undefined;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return matchedArg?.toString() ?? match;
  });
}

/**
 * Retrieves a localized message string, without substituting any variables. This resolves any plural forms using the given args
 * @param token - The token identifying the message to retrieve.
 * @param args - An optional record of substitution variables and their replacement values. This is required if the string has dynamic variables.
 *
 * @returns The localized message string with substitutions applied.
 *
 * NOTE: This is intended to be used to get the raw string then format it with {@link formatMessageWithArgs}
 */
export function getRawMessage<T extends MergedLocalizerTokens>(
  crowdinLocale: CrowdinLocale,
  details: GetMessageArgs<T>
): T | string {
  const { token } = details;
  const args = messageArgsToArgsOnly(details);
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
  } catch (error) {
    log(stringifyError(error));
    return token;
  }
}

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

const pluralKey = 'count' as const;

export class LocalizedStringBuilder<T extends MergedLocalizerTokens> extends String {
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
      log(stringifyError(error));
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

  stripIt(): Omit<this, 'stripIt'> {
    const sanitizedArgs = this.args ? sanitizeArgs(this.args, '\u200B') : undefined;
    if (sanitizedArgs) {
      this.args = sanitizedArgs as ArgsFromToken<T>;
    }
    this.isStripped = true;

    return this;
  }

  private postProcessStrippedString(str: string): string {
    if (typeof process.env.TEST_WORKER_INDEX === 'string' && process.env.TEST_WORKER_INDEX.length) {
      // Special case for when running in playwright (those files are reused for session-appium & session-playwright as is).
      // When that's the case, we need to replace `<br/>` and `<br/><br/>` with a single space.
      // " <br/><br/>" and "<br/>" both become a single space
      return str.replace(/\s*(<br\s*\/?>[\s]*)+/gi, ' ').replace(/<[^>]*>/g, '');
    }
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
        throw new Error(`invalid token provided: ${this.token}`);
      }

      return this.resolvePluralString();
    } catch (error) {
      log(stringifyError(error));
      return this.token;
    }
  }

  private resolvePluralString(): string {
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

    return pluralString;
  }

  private formatStringWithArgs(str: string): string {
    /** Find and replace the dynamic variables in a localized string and substitute the variables with the provided values */
    return str.replace(/\{(\w+)\}/g, (match, arg: string) => {
      const matchedArg =
        this.args && arg in this.args
          ? (this.args as Record<string, unknown>)[arg]?.toString()
          : undefined;

      if (arg === pluralKey && typeof matchedArg === 'number' && Number.isFinite(matchedArg)) {
        return new Intl.NumberFormat(this.crowdinLocale).format(matchedArg);
      }

      return matchedArg?.toString() ?? match;
    });
  }
}

export function tr<T extends MergedLocalizerTokens>(
  token: T,
  ...args: ArgsFromToken<T> extends undefined ? [] : [args: ArgsFromToken<T>]
): string {
  const builder = new LocalizedStringBuilder<T>(token, localeInUse);
  if (args.length) {
    builder.withArgs(args[0]);
  }
  return builder.toString();
}

export function tEnglish<T extends MergedLocalizerTokens>(
  token: T,
  ...args: ArgsFromToken<T> extends undefined ? [] : [args: ArgsFromToken<T>]
): string {
  const builder = new LocalizedStringBuilder<T>(token, localeInUse).forceEnglish();
  if (args.length) {
    builder.withArgs(args[0]);
  }
  return builder.toString();
}

export function tStripped<T extends MergedLocalizerTokens>(
  token: T,
  ...args: ArgsFromToken<T> extends undefined ? [] : [args: ArgsFromToken<T>]
): string {
  const builder = new LocalizedStringBuilder<T>(token, localeInUse).stripIt();
  if (args.length) {
    builder.withArgs(args[0]);
  }
  return builder.toString();
}

export type LocalizerHtmlTag = 'div' | 'span';

export function messageArgsToArgsOnly<T extends MergedLocalizerTokens>(
  details: GetMessageArgs<T>
): ArgsFromToken<T> {
  const pl = omit(details, ['token']) as unknown as ArgsFromToken<T>;
  return pl;
}
