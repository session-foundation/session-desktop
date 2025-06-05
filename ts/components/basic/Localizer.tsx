import styled from 'styled-components';
import { SessionHtmlRenderer } from './SessionHTMLRenderer';
import {
  GetMessageArgs,
  isArgsFromTokenWithIcon,
  MergedLocalizerTokens,
  sanitizeArgs,
  type LocalizerComponentProps,
} from '../../localization/localeTools';
import { getCrowdinLocale } from '../../util/i18n/shared';
import { LUCIDE_INLINE_ICONS, type LucideInlineIconKeys } from '../icon/lucide';

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

export type LocalizerProps = LocalizerComponentProps<MergedLocalizerTokens, LucideInlineIconKeys>;

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
  props: LocalizerComponentProps<T, LucideInlineIconKeys>
) => {
  const args = 'args' in props ? props.args : undefined;

  let rawString: string = window.i18n.getRawMessage<T>(
    getCrowdinLocale(),
    ...([props.token, args] as GetMessageArgs<T>)
  );

  // NOTE If the string contains an icon we want to replace it with the relevant html from LUCIDE_ICONS before we sanitize the args
  if (isArgsFromTokenWithIcon<MergedLocalizerTokens, LucideInlineIconKeys>(props.args)) {
    rawString = rawString.replaceAll(/\{icon}/g, LUCIDE_INLINE_ICONS[props.args.icon]);
  }

  const containsFormattingTags = createSupportedFormattingTagsRegex().test(rawString);
  const cleanArgs = args && containsFormattingTags ? sanitizeArgs(args) : args;

  const containsIcons = !!(cleanArgs && Object.keys(cleanArgs).includes('icon'));
  if (containsIcons && (cleanArgs as any).icon) {
    rawString = rawString.replaceAll(/\{icon}/g, `<span role='img'>{icon}</span>`);
  }

  const i18nString = window.i18n.formatMessageWithArgs(
    rawString,
    cleanArgs as GetMessageArgs<T>[1]
  );

  return containsFormattingTags || containsIcons ? (
    /** If the string contains a relevant formatting tag, render it as HTML */
    <StyledHtmlRenderer>
      <SessionHtmlRenderer tag={props.asTag} html={i18nString} className={props.className} />
    </StyledHtmlRenderer>
  ) : (
    i18nString
  );
};
