import type { MouseEvent, ReactNode, SessionDataTestId } from 'react';
import styled from 'styled-components';
import { useIsDarkTheme } from '../../../state/theme/selectors/theme';
import { StyledPanelButton, StyledContent } from './PanelButton';
import { StyledPanelButtonSeparator } from './StyledPanelButtonGroupSeparator';

const StyledActionContainer = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  pointer-events: none; // let the container handle the event (otherwise we get 2 onClick events, cancelling each others)
`;

export type GenericPanelButtonProps = {
  textElement: ReactNode;
  actionElement: ReactNode;
  onClick: undefined | ((e: MouseEvent<any>) => void | Promise<void>);
  rowDataTestId: SessionDataTestId;
};

export const GenericPanelButtonWithAction = (props: GenericPanelButtonProps) => {
  const { actionElement, rowDataTestId, textElement, onClick } = props;
  const isDarkTheme = useIsDarkTheme();
  const disabled = !onClick;

  return (
    <>
      <StyledPanelButton
        disabled={disabled}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={onClick}
        data-testid={rowDataTestId}
        isDarkTheme={isDarkTheme}
      >
        <StyledContent disabled={disabled}>
          {textElement}
          <StyledActionContainer>{actionElement}</StyledActionContainer>
        </StyledContent>
      </StyledPanelButton>
      <StyledPanelButtonSeparator />
    </>
  );
};
