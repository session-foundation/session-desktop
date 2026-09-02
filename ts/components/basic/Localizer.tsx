import styled from 'styled-components';
import { SessionHtmlRenderer } from './SessionHTMLRenderer';
import {
  formatMessageWithArgs,
  GetMessageArgs,
  MergedLocalizerTokens,
  sanitizeArgs,
  getRawMessage,
  messageArgsToArgsOnly,
  type ArgsFromToken,
  type LocalizerHtmlTag,
} from '../../localization/localeTools';
import { getCrowdinLocale } from '../../util/i18n/shared';

/** An array of supported html tags to render if found in a string */
export const supportedFormattingTags = ['b', 'i', 'u', 's', 'br', 'span'];
/** NOTE: self-closing tags must also be listed in {@link supportedFormattingTags} */
const supportedSelfClosingFormattingTags = ['br'];

function createSupportedFormattingTagsRegex() {
  return new RegExp(
    `<(?:${supportedFormattingTags.join('|')})>.*?</(?:${supportedFormattingTags.join('|')})>|<(?:${supportedSelfClosingFormattingTags.join('|')})\\/>`,
    'g'
  );
}

const StyledHtmlRenderer = styled.span`
  * > span {
    color: var(--renderer-span-primary-color);
  }

  * > span[role='img'] {
    font-family: var(--font-icon);
    vertical-align: top;
  }
`;

export type WithAsTag = { asTag?: LocalizerHtmlTag };
export type WithClassName = { className?: string };
/**
 * Names of args whose value is trusted, pre-formatted HTML that should skip the arg-level escaping
 * applied when the template contains formatting tags. Safe only for app-controlled content: the final
 * string is still run through DOMPurify (the {@link supportedFormattingTags} whitelist) by
 * SessionHtmlRenderer, so only formatting survives — never scripts or attributes. NEVER list a
 * user-controlled arg here.
 */
export type WithHtmlArgs = { htmlArgs?: Array<string> };

/**
 * Retrieve a localized message string, substituting dynamic parts where necessary and formatting it as HTML if necessary.
 *
 * @param props.token - The token identifying the message to retrieve and an optional record of substitution variables and their replacement values.
 * @param props.args - An optional record of substitution variables and their replacement values. This is required if the string has dynamic parts.
 * @param props.as - An optional HTML tag to render the component as. Defaults to a fragment, unless the string contains html tags. In that case, it will render as HTML in a div tag.
 *
 * @returns The localized message string with substitutions and formatting applied.
 */
export const Localizer = <T extends MergedLocalizerTokens>(
  props: GetMessageArgs<T> & WithAsTag & WithClassName & WithHtmlArgs
) => {
  const args = messageArgsToArgsOnly(props);

  let rawString: string = getRawMessage<T>(getCrowdinLocale(), props);

  const containsFormattingTags = createSupportedFormattingTagsRegex().test(rawString);
  // When the template has formatting tags we HTML-escape the args so dynamic values can't inject
  // markup. Args named in `htmlArgs` opt out of that escaping so they can carry trusted, pre-formatted
  // HTML (e.g. a client-built <br/>• list) — still XSS-safe because SessionHtmlRenderer runs DOMPurify
  // (supportedFormattingTags whitelist) on the final string.
  const cleanArgs = ((): typeof args => {
    if (!args || !containsFormattingTags) {
      return args;
    }
    const htmlArgKeys = props.htmlArgs;
    if (!htmlArgKeys?.length) {
      return sanitizeArgs(args) as typeof args;
    }
    const toSanitize: Record<string, number | string> = {};
    const trusted: Record<string, number | string> = {};
    for (const [key, value] of Object.entries(args as Record<string, number | string>)) {
      (htmlArgKeys.includes(key) ? trusted : toSanitize)[key] = value;
    }
    return { ...sanitizeArgs(toSanitize), ...trusted } as typeof args;
  })();

  const containsIcons = !!(cleanArgs && Object.keys(cleanArgs).includes('icon'));
  if (containsIcons && (cleanArgs as any).icon) {
    rawString = rawString.replaceAll(/\{icon}/g, `<span role='img'>{icon}</span>`);
  }

  const i18nString = formatMessageWithArgs(rawString, cleanArgs as ArgsFromToken<T>);

  return containsFormattingTags || containsIcons ? (
    /** If the string contains a relevant formatting tag, render it as HTML */
    <StyledHtmlRenderer>
      <SessionHtmlRenderer tag={props.asTag} html={i18nString} className={props.className} />
    </StyledHtmlRenderer>
  ) : (
    i18nString
  );
};
