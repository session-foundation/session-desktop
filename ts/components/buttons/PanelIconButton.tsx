import styled from 'styled-components';

import type { ReactNode } from 'react';
import { PanelButton, PanelButtonProps, PanelButtonText, StyledContent } from './PanelButton';
import { LucideIcon } from '../icon/LucideIcon';
import { IconSizeToPxStr } from '../icon/SessionIcon';

interface PanelIconButtonProps extends Omit<PanelButtonProps, 'children'> {
  text: string;
  iconElement: ReactNode;
  subtitle?: string;
  color?: string;
}

const IconContainer = styled.div`
  flex-shrink: 0;
  margin: 0 var(--margins-lg) 0 var(--margins-sm);
  padding: 0;
`;

export const PanelIconButton = (props: PanelIconButtonProps) => {
  const { text, subtitle, color, disabled = false, onClick, dataTestId } = props;

  return (
    <PanelButton disabled={disabled} onClick={onClick} dataTestId={dataTestId}>
      <StyledContent disabled={disabled}>
        <IconContainer>{props.iconElement}</IconContainer>
        <PanelButtonText text={text} subtitle={subtitle} color={color} />
      </StyledContent>
    </PanelButton>
  );
};

export const PanelIconLucideIcon = ({ iconUnicode }: { iconUnicode: string }) => {
  // we shouldn't need to provide a color here, as the Icon should match what the PanelButton color is.
  return <LucideIcon unicode={iconUnicode} iconSize={IconSizeToPxStr.large} />;
};
