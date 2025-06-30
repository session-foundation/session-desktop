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

export const renderUserMentionRow = (id: string) => {
  return (
    <MemberListItem
      key={`suggestion-list-${id}`}
      isSelected={false}
      pubkey={id}
      inMentions={true}
      dataTestId="mentions-popup-row"
      maxNameWidth="100%"
    />
  );
};
