/**
 * @prettier
 */

import styled from 'styled-components';

interface Props {
  label: string;
}

const StyledEmptyState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-grow: 1;
  margin-top: var(--margins-sm);
  font-size: 16px;
  text-align: center;
`;

export const EmptyState = (props: Props) => {
  const { label } = props;

  return <StyledEmptyState>{label}</StyledEmptyState>;
};
