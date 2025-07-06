import { ReactNode, SessionDataTestId, type PropsWithChildren } from 'react';
import styled, { CSSProperties } from 'styled-components';
import { Flex } from '../basic/Flex';
import { H8 } from '../basic/Heading';
import { SpacerXS } from '../basic/Text';
import { useIsDarkTheme } from '../../state/theme/selectors/theme';

// NOTE Used for descendant components
export const StyledContent = styled.div<{ disabled: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  color: ${props => (props.disabled ? 'var(--disabled-color)' : 'inherit')};
`;

export const PanelLabel = styled.p`
  color: var(--text-secondary-color);
  width: 100%;
  margin: 0;
  padding-left: var(--margins-lg);
  padding-block: var(--margins-sm);
`;

const StyledRoundedPanelButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  background: var(--background-tertiary-color);
  border-radius: 16px;
  // Note: we need no padding here so we can change the bg color on hover
  padding: 0;
  margin: 0 var(--margins-xs);
  width: -webkit-fill-available;
`;

const PanelButtonContainer = styled.div`
  overflow: auto;
  min-height: 50px;
  max-height: 100%;
`;

type PanelButtonGroupProps = {
  children: ReactNode;
  style?: CSSProperties;
};

export const PanelButtonGroup = (props: PanelButtonGroupProps) => {
  const { children, style } = props;
  return (
    <StyledRoundedPanelButtonGroup style={style}>
      <PanelButtonContainer>{children}</PanelButtonContainer>
    </StyledRoundedPanelButtonGroup>
  );
};

export const StyledPanelButton = styled.button<{
  disabled: boolean;
  color?: string;
  isDarkTheme: boolean;
}>`
  cursor: ${props => (props.disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  flex-grow: 1;
  font-family: var(--font-default);
  width: 100%;
  transition: var(--default-duration);
  color: ${props => (props.disabled ? 'var(--disabled-color)' : props.color)};
  padding-inline: var(--margins-lg);
  padding-block: var(--margins-sm);

  &:hover {
    background-color: ${props =>
      !props.disabled &&
      (props.isDarkTheme
        ? 'var(--background-primary-color)'
        : 'var(--background-secondary-color)')};
  }
`;

export type PanelButtonProps = {
  // https://styled-components.com/docs/basics#styling-any-component
  className?: string;
  disabled?: boolean;
  children: ReactNode;
  onClick: (...args: Array<any>) => void;
  dataTestId: SessionDataTestId;
  style?: CSSProperties;
  color?: string;
};

export const PanelButton = (props: PanelButtonProps) => {
  const { className, disabled = false, children, onClick, dataTestId, style, color } = props;

  const isDarkTheme = useIsDarkTheme();

  return (
    <StyledPanelButton
      className={className}
      disabled={disabled}
      onClick={onClick}
      style={style}
      data-testid={dataTestId}
      color={color}
      isDarkTheme={isDarkTheme}
    >
      {children}
    </StyledPanelButton>
  );
};

const StyledSubtitle = styled.p<{ color?: string }>`
  font-size: var(--font-size-sm);
  line-height: 1.1;
  margin-top: 0;
  margin-bottom: 0;
  text-align: start;
  ${props => props.color && `color: ${props.color};`}
`;

/**
 * PanelButtonText can be used in two ways:
 * 1. As a simple text with no subtitle
 * 2. As a text with a subtitle
 * If a subtitle is provided, it's dataTestId is required too.
 */
type PanelButtonTextBaseProps = {
  text: string;
  textDataTestId: SessionDataTestId;
  color?: string;
};

export type PanelButtonSubtextProps = {
  subText: string;
  subTextDataTestId: SessionDataTestId;
};

const PanelButtonTextInternal = (props: PropsWithChildren) => {
  return (
    <Flex
      $container={true}
      width={'100%'}
      $flexDirection={'column'}
      $alignItems={'flex-start'}
      margin="0 var(--margins-lg) 0 0"
      minWidth="0"
    >
      {props.children}
    </Flex>
  );
};

function TextOnly(props: PanelButtonTextBaseProps) {
  return (
    <H8
      color={props.color}
      data-testid={props.textDataTestId}
      fontWeight={500}
      style={{
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        width: '100%',
        textAlign: 'start',
      }}
    >
      {props.text}
    </H8>
  );
}

export const PanelButtonTextWithSubText = (
  props: PanelButtonTextBaseProps & PanelButtonSubtextProps
) => {
  return (
    <PanelButtonTextInternal>
      <TextOnly color={props.color} textDataTestId={props.textDataTestId} text={props.text} />
      <SpacerXS />
      <StyledSubtitle color={props.color} data-testid={props.subTextDataTestId}>
        {props.subText}
      </StyledSubtitle>
    </PanelButtonTextInternal>
  );
};

export const PanelButtonText = (props: PanelButtonTextBaseProps) => {
  return (
    <PanelButtonTextInternal>
      <TextOnly color={props.color} textDataTestId={props.textDataTestId} text={props.text} />
    </PanelButtonTextInternal>
  );
};
