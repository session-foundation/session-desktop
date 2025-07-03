import styled from 'styled-components';
import { SessionDataTestId, type ReactNode } from 'react';
import { SessionRadio } from '../basic/SessionRadio';
import { PanelButtonProps, StyledContent, StyledPanelButton } from './PanelButton';
import { useIsDarkTheme } from '../../state/theme/selectors/theme';
import { StyledPanelButtonSeparator } from './StyledPanelButtonGroupSeparator';

const StyledCheckContainer = styled.div`
  display: flex;
  align-items: center;
`;

type PanelRadioButtonProps = Omit<PanelButtonProps, 'children' | 'onClick' | 'dataTestId'> & {
  value: any;
  textElement: ReactNode;
  isSelected: boolean;
  onSelect?: (...args: Array<any>) => void;
  onUnselect?: (...args: Array<any>) => void;
  // the row dataTestId is used to identify the whole row, not the radio button
  rowDataTestId: SessionDataTestId;
  // the radio input dataTestId is used to identify the radio button only.
  // the textElement will have its own dataTestId
  radioInputDataTestId: SessionDataTestId;
};

export const PanelRadioButton = (props: PanelRadioButtonProps) => {
  const {
    value,
    isSelected,
    onSelect,
    onUnselect,
    disabled = false,
    rowDataTestId,
    radioInputDataTestId,
    textElement,
  } = props;
  const isDarkTheme = useIsDarkTheme();

  return (
    <>
      <StyledPanelButton
        disabled={disabled}
        onClick={() => {
          return isSelected ? onUnselect?.('bye') : onSelect?.('hi');
        }}
        data-testid={rowDataTestId}
        isDarkTheme={isDarkTheme}
      >
        <StyledContent disabled={disabled}>
          {textElement}
          <StyledCheckContainer>
            <SessionRadio
              active={isSelected}
              value={value}
              inputName={value}
              disabled={disabled}
              inputDataTestId={radioInputDataTestId}
              style={{ paddingInlineEnd: 'var(--margins-xs)' }}
            />
          </StyledCheckContainer>
        </StyledContent>
      </StyledPanelButton>
      <StyledPanelButtonSeparator />
    </>
  );
};
