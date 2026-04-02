import styled from 'styled-components';
import type { SessionDataTestId, MouseEvent } from 'react';
import { Flex } from '../../../basic/Flex';
import { LucideIcon } from '../../../icon/LucideIcon';
import type { WithLucideUnicode } from '../../../icon/lucide';

export const ActionRowIconWidth = 58;

export const StyledChooseActionTitle = styled.span`
  color: var(--text-primary-color);
  font-size: 18px;
  padding: var(--margins-md) 0;
  text-align: start;
  width: 100%;
`;

const StyledIcon = styled.div`
  width: ${ActionRowIconWidth}px;
  flex-shrink: 0;
`;

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

export const StyledActionRowHr = styled.div<{ $marginLeft?: number }>`
  height: 0.5px;
  width: 100%;
  border-top: 0.5px solid var(--borders-color);
  padding: 0;
  margin: 0;
  margin-left: ${({ $marginLeft }) => $marginLeft}px;
  transition: opacity var(--default-duration);
  pointer-events: none;

  // tsc is not happy when we merge those together, so we have to keep them separate...
  // hide the separator when the previous row is hovered or focused
  &:has(+ ${StyledActionRow}:hover) {
    opacity: 0;
  }

  &:has(+ ${StyledActionRow}:focus-visible) {
    opacity: 0;
  }

  // hide the separator when the next row is hovered and focused
  ${StyledActionRow}:hover + & {
    opacity: 0;
  }

  ${StyledActionRow}:focus-visible + & {
    opacity: 0;
  }
`;

export const StyledActionRowContainer = styled(Flex)`
  width: 100%;
  border-top: var(--default-borders);
  border-bottom: var(--default-borders);
  transition:
    border-top-color var(--default-duration),
    border-bottom-color var(--default-duration);

  &:has(button:first-of-type:hover),
  &:has(button:first-of-type:focus-visible) {
    border-top-color: var(--transparent-color);
  }

  &:has(button:last-of-type:hover),
  &:has(button:last-of-type:focus-visible) {
    border-bottom-color: var(--transparent-color);
  }
`;

type ActionRowProps = WithLucideUnicode & {
  title: string;
  ariaLabel: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
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
      </Flex>
    </StyledActionRow>
  );
}
