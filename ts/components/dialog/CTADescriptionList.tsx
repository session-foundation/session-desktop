import { ReactNode } from 'react';
import styled from 'styled-components';
import { FileIcon } from '../icon/FileIcon';
import { LucideIcon } from '../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

export const StyledCTADescriptionList = styled.ul`
  list-style: none;
  padding-inline-start: 0;
  text-align: start;
  display: grid;
  font-size: var(--font-size-lg);
  grid-row-gap: var(--margins-md);
  margin-block: 0;
`;

const StyledListItem = styled.li`
  display: inline-flex;
  gap: var(--margins-sm);
  align-items: end;
  line-height: normal;
`;

export function CTADescriptionListItem({
  children,
  index,
  customIconSrc,
}: {
  children: ReactNode;
  index: number;
  customIconSrc?: string;
}) {
  return (
    <StyledListItem data-testid={`cta-list-item-${index + 1}`}>
      {customIconSrc ? (
        <FileIcon iconSize={'var(--font-size-xl)'} src={customIconSrc} />
      ) : (
        <LucideIcon
          unicode={LUCIDE_ICONS_UNICODE.CIRCLE_CHECK}
          iconSize={'medium'}
          iconColor={'var(--primary-color)'}
        />
      )}
      {children}
    </StyledListItem>
  );
}
