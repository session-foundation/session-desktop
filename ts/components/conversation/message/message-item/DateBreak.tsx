import styled from 'styled-components';
import { DURATION } from '../../../../session/constants';
import { formatRelativeTimestampWithLocale } from '../../../../util/i18n/formatting/generics';
import { useFormatFullDate } from '../../../../hooks/useFormatFullDate';

const DateBreakContainer = styled.div``;

const DateBreakText = styled.div`
  margin-top: 0.3rem;
  margin-bottom: 0.3rem;
  letter-spacing: 0.6px;
  font-size: 0.8rem;
  font-weight: bold;
  text-align: center;

  color: var(--text-primary-color);
`;

export const MessageDateBreak = (props: { timestamp: number; messageId: string }) => {
  const { timestamp, messageId } = props;
  const formattedFullDate = useFormatFullDate(timestamp);
  // if less than 7 days, we display the "last Thursday at 4:10" syntax
  // otherwise, we display the date + time separately
  const text =
    Date.now() - timestamp <= DURATION.DAYS * 7
      ? formatRelativeTimestampWithLocale(timestamp)
      : formattedFullDate;

  return (
    <DateBreakContainer id={`date-break-${messageId}`}>
      <DateBreakText>{text}</DateBreakText>
    </DateBreakContainer>
  );
};
