import styled from 'styled-components';

import type { ReactNode } from 'react';
import {
  PanelButton,
  PanelButtonProps,
  PanelButtonText,
  PanelButtonTextWithSubText,
  StyledContent,
  type PanelButtonSubtextProps,
} from './PanelButton';
import { LucideIcon } from '../../icon/LucideIcon';
import { SessionIcon } from '../../icon/SessionIcon';
import type { SessionIconType } from '../../icon';
import type { WithLucideUnicode } from '../../icon/lucide';
import { StyledPanelButtonSeparator } from './StyledPanelButtonGroupSeparator';
import type { TrArgs } from '../../../localization/localeTools';

type PanelIconButtonProps = Omit<PanelButtonProps, 'children' | 'subText' | 'subTextDataTestId'> & {
  iconElement: ReactNode;
  color?: string;
  text: TrArgs;
  rowReverse?: boolean;
};

const IconContainer = styled.div<{ rowReverse?: boolean }>`
  flex-shrink: 0;
  margin: ${props =>
    props.rowReverse
      ? '0 var(--margins-sm) 0 var(--margins-lg)'
      : '0 var(--margins-lg) 0 var(--margins-sm)'};
  padding: 0;
`;

export const PanelIconButton = (
  props: PanelIconButtonProps | (PanelIconButtonProps & PanelButtonSubtextProps)
) => {
  const { text, color, disabled = false, onClick, rowReverse, dataTestId } = props;

  const subTextProps =
    'subText' in props
      ? { subText: props.subText, subTextDataTestId: props.subTextDataTestId }
      : undefined;

  return (
    <>
      <PanelButton
        disabled={disabled}
        onClick={onClick}
        dataTestId={dataTestId}
        color={color}
        style={{ minHeight: '55px' }}
      >
        <StyledContent disabled={disabled} rowReverse={rowReverse}>
          <IconContainer rowReverse={rowReverse}>{props.iconElement}</IconContainer>

          {subTextProps ? (
            <PanelButtonTextWithSubText
              text={text}
              textDataTestId={props.dataTestId}
              subText={subTextProps.subText}
              subTextDataTestId={subTextProps.subTextDataTestId}
            />
          ) : (
            <PanelButtonText text={text} textDataTestId={props.dataTestId} />
          )}
        </StyledContent>
      </PanelButton>
      <StyledPanelButtonSeparator />
    </>
  );
};

export const PanelIconLucideIcon = ({ unicode }: WithLucideUnicode) => {
  // we shouldn't need to provide a color here, as the Icon should match what the PanelButton color is.
  return <LucideIcon unicode={unicode} iconSize={'large'} />;
};

export const PanelIconSessionLegacyIcon = ({
  iconType,
  iconColor,
}: {
  iconType: SessionIconType;
  iconColor: string;
}) => {
  return <SessionIcon iconType={iconType} iconSize="large" iconColor={iconColor} />;
};
