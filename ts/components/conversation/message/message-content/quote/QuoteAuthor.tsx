import styled from 'styled-components';
import { useSelectedConversationKey } from '../../../../../state/selectors/selectedConversation';
import { ContactName } from '../../../ContactName/ContactName';
import { QuoteProps } from './Quote';

const StyledQuoteAuthor = styled.div<{ $isIncoming: boolean }>`
  color: ${props =>
    props.$isIncoming
      ? 'var(--message-bubble-incoming-text-color)'
      : 'var(--message-bubble-outgoing-text-color)'};
  font-size: var(--font-size-md);
  font-weight: bold;
  line-height: 18px;
  margin-bottom: 2px;
  overflow-x: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  .module-contact-name {
    font-weight: bold;
  }
`;

type QuoteAuthorProps = Pick<QuoteProps, 'author' | 'isIncoming'>;

export const QuoteAuthor = (props: QuoteAuthorProps) => {
  const { author, isIncoming } = props;

  const selectedConversationKey = useSelectedConversationKey();

  if (!author || !selectedConversationKey) {
    return null;
  }

  return (
    <StyledQuoteAuthor $isIncoming={isIncoming}>
      <ContactName
        pubkey={author}
        contactNameContext="quote-author"
        conversationId={selectedConversationKey}
      />
    </StyledQuoteAuthor>
  );
};
