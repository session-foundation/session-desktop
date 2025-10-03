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
 * Retrieve a localized message string, substituting dynamic parts where necessary and formatting it as HTML if necessary.
 *
 * @param props.token - The token identifying the message to retrieve and an optional record of substitution variables and their replacement values.
 * @param props.args - An optional record of substitution variables and their replacement values. This is required if the string has dynamic parts.
 * @param props.as - An optional HTML tag to render the component as. Defaults to a fragment, unless the string contains html tags. In that case, it will render as HTML in a div tag.
 *
 * @returns The localized message string with substitutions and formatting applied.
 */
export const Localizer = <T extends MergedLocalizerTokens>(
  props: GetMessageArgs<T> & WithAsTag & WithClassName
) => {
  const args = messageArgsToArgsOnly(props);

  let rawString: string = getRawMessage<T>(getCrowdinLocale(), props);

  const containsFormattingTags = createSupportedFormattingTagsRegex().test(rawString);
  const cleanArgs = args && containsFormattingTags ? sanitizeArgs(args) : args;

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
