import { MouseEvent } from 'react';
import styled from 'styled-components';
import { LucideIcon } from '../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

interface Props {
  onClick: (e: MouseEvent<HTMLDivElement>) => void;
}

const StyledStagedPlaceholderAttachment = styled.div`
  margin: 1px 0;
  border-radius: var(--border-radius-message-box);
  border: var(--default-borders);
  height: 120px;
  width: 120px;
  display: inline-block;
  vertical-align: middle;
  cursor: pointer;
  position: relative;

  &:hover {
    background-color: var(--background-secondary-color);
  }
`;

export const StagedPlaceholderAttachment = (props: Props) => {
  const { onClick } = props;

  return (
    <StyledStagedPlaceholderAttachment role="button" onClick={onClick}>
      <LucideIcon
        unicode={LUCIDE_ICONS_UNICODE.PLUS}
        iconSize="huge2"
        style={{
          width: '100%',
          height: '100%',
          alignContent: 'center',
          textAlign: 'center',
        }}
      />
    </StyledStagedPlaceholderAttachment>
  );
};
