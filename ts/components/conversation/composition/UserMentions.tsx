import type { SuggestionDataItem } from 'react-mentions';
import { MemberListItem } from '../../MemberListItem';
import { HTMLDirection } from '../../../util/i18n/rtlSupport';

const listRTLStyle = { position: 'absolute', bottom: '0px', right: '100%' };

export const styleForCompositionBoxSuggestions = (dir: HTMLDirection = 'ltr') => {
  const styles = {
    suggestions: {
      list: {
        fontSize: 14,
        boxShadow: 'var(--suggestions-shadow)',
        backgroundColor: 'var(--suggestions-background-color)',
        color: 'var(--suggestions-text-color)',
        dir,
      },
      item: {
        height: '100%',
        paddingTop: '5px',
        paddingBottom: '5px',
        backgroundColor: 'var(--suggestions-background-color)',
        color: 'var(--suggestions-text-color)',
        transition: 'var(--default-duration)',

        '&focused': {
          backgroundColor: 'var(--suggestions-background-hover-color)',
        },
      },
    },
  };

  if (dir === 'rtl') {
    styles.suggestions.list = { ...styles.suggestions.list, ...listRTLStyle };
  }

  return styles;
};

export const renderUserMentionRow = (suggestion: Pick<SuggestionDataItem, 'id'>) => {
  return (
    <MemberListItem
      key={`suggestion-list-${suggestion.id}`}
      isSelected={false}
      pubkey={`${suggestion.id}`}
      inMentions={true}
      dataTestId="mentions-popup-row"
      maxNameWidth="100%"
    />
  );
};

// this is dirty but we have to replace all @(xxx) by @xxx manually here
export function cleanMentions(text: string): string {
  const matches = text.match(mentionsRegex);
  let replacedMentions = text;
  (matches || []).forEach(match => {
    const replacedMention = match.substring(2, match.indexOf('\uFFD7'));
    replacedMentions = replacedMentions.replace(match, `@${replacedMention}`);
  });

  return replacedMentions;
}

export const mentionsRegex = /@\uFFD2[0-1]5[0-9a-f]{64}\uFFD7[^\uFFD2]+\uFFD2/gu;
