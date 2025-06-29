import styled from 'styled-components';
import { SessionDataTestId } from 'react';
import { Flex } from '../../../basic/Flex';
import { LucideIcon } from '../../../icon/LucideIcon';
import type { WithLucideUnicode } from '../../../icon/lucide';

const StyledActionRow = styled.button`
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  transition-duration: var(--default-duration);
  width: 100%;

  &:hover {
    background: var(--conversation-tab-background-hover-color);
  }
`;

export const StyledChooseActionTitle = styled.span`
  color: var(--text-primary-color);
  font-size: 18px;
  padding: var(--margins-md) 0;
  text-align: start;
  width: 100%;
`;

const StyledIcon = styled.div`
  width: 58px;
`;

const StyledHR = styled.hr`
  height: 0px;
  width: 100%;
  border: 0.5px solid var(--border-color);
  padding: 0;
  margin: 0;
`;

export const StyledActionRowContainer = styled(Flex)`
  width: 100%;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);

  ${StyledActionRow}:last-child ${StyledHR} {
    border-color: transparent;
  }
`;

type ActionRowProps = WithLucideUnicode & {
  title: string;
  ariaLabel: string;
  onClick: () => void;
  dataTestId: SessionDataTestId;
};

export function ActionRow(props: ActionRowProps) {
  const { title, ariaLabel, unicode, onClick, dataTestId } = props;

  return (
    <StyledActionRow onClick={onClick} data-testid={dataTestId} aria-label={ariaLabel}>
      <StyledIcon>
        <LucideIcon unicode={unicode} iconSize={'medium'} iconColor="var(--text-primary-color)" />
      </StyledIcon>
      <Flex
        $container={true}
        $flexDirection={'column'}
        $justifyContent={'flex-start'}
        $alignItems={'flex-start'}
        width={'100%'}
      >
        <StyledChooseActionTitle>{title}</StyledChooseActionTitle>
        <StyledHR />
      </Flex>
    </StyledActionRow>
  );
}
