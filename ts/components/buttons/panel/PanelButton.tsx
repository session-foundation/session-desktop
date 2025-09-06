import { ReactNode, SessionDataTestId, type PropsWithChildren } from 'react';
import styled, { CSSProperties } from 'styled-components';

import { Flex } from '../../basic/Flex';
import { H8 } from '../../basic/Heading';
import { SpacerXS } from '../../basic/Text';
import { Localizer } from '../../basic/Localizer';
import type { TrArgs } from '../../../localization/localeTools';
import { useIsDarkTheme } from '../../../state/theme/selectors/theme';

// NOTE Used for descendant components
export const StyledContent = styled.div<{ disabled: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  color: ${props => (props.disabled ? 'var(--disabled-color)' : 'inherit')};
`;

const StyledPanelLabel = styled.p`
  color: var(--text-secondary-color);
  margin: 0;
  align-self: flex-start;
  padding-inline: var(--margins-lg);
`;

const StyledPanelDescription = styled(StyledPanelLabel)`
  color: var(--text-primary-color);
`;

const StyledPanelLabelWithDescription = styled.div`
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  gap: var(--margins-xs);
  padding-block: var(--margins-sm);
`;

export function PanelLabelWithDescription({
  title,
  description,
}: {
  title: TrArgs;
  description?: TrArgs;
}) {
  return (
    <StyledPanelLabelWithDescription>
      {/* less space between the label and the description */}
      <StyledPanelLabel>
        <Localizer {...title} />
      </StyledPanelLabel>
      {description ? (
        <StyledPanelDescription>
          <Localizer {...description} />
        </StyledPanelDescription>
      ) : null}
    </StyledPanelLabelWithDescription>
  );
}

const StyledRoundedPanelButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  background: var(--background-tertiary-color);
  border-radius: 16px;
  // Note: we need no padding here so we can change the bg color on hover
  padding: 0;
  width: -webkit-fill-available;
`;

const PanelButtonContainer = styled.div`
  overflow: auto;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

type PanelButtonGroupProps = {
  children: ReactNode;
  style?: CSSProperties;
};

export const PanelButtonGroup = (
  props: PanelButtonGroupProps & { containerStyle?: CSSProperties }
) => {
  const { children, style, containerStyle } = props;
  return (
    <StyledRoundedPanelButtonGroup style={style}>
      <PanelButtonContainer style={containerStyle}>{children}</PanelButtonContainer>
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
  min-height: var(--panel-button-container-min-height);

  &:hover {
    background-color: ${props => {
      if (props.disabled) {
        return 'transparent'; // let the PanelButtonGroup background be visible
      }
      if (props.isDarkTheme) {
        return 'color-mix(in srgb, var(--background-tertiary-color) 95%, white)';
      }
      return 'color-mix(in srgb, var(--background-tertiary-color) 95%, black)';
    }};
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
  display: flex;
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
  textDataTestId: SessionDataTestId;
  color?: string;
} & ({ text: TrArgs } | { label: string });

export type PanelButtonSubtextProps = {
  subText: TrArgs;
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
      fontWeight={700}
      style={{
        // We need this to wrap so we don't cut long titles in the
        // user settings page, even if it means having multiple lines
        whiteSpace: 'wrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        width: '100%',
        textAlign: 'start',
      }}
    >
      {'text' in props ? <Localizer {...props.text} /> : props.label}
    </H8>
  );
}

export const PanelButtonTextWithSubText = (
  props: PanelButtonTextBaseProps & PanelButtonSubtextProps & { extraSubTextNode?: ReactNode }
) => {
  return (
    <PanelButtonTextInternal>
      <TextOnly color={props.color} {...props} />
      <SpacerXS />
      <StyledSubtitle color={props.color} data-testid={props.subTextDataTestId}>
        <Localizer {...props.subText} />
        {props.extraSubTextNode}
      </StyledSubtitle>
    </PanelButtonTextInternal>
  );
};

export const PanelButtonText = (props: PanelButtonTextBaseProps) => {
  return (
    <PanelButtonTextInternal>
      <TextOnly color={props.color} {...props} />
    </PanelButtonTextInternal>
  );
};
