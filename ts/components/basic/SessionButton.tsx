import type { CSSProperties, ReactNode, RefObject, SessionDataTestId } from 'react';
import styled from 'styled-components';
import clsx from 'clsx';
import { useIsDarkTheme } from '../../state/theme/selectors/theme';

export enum SessionButtonType {
  Outline = 'outline',
  Simple = 'simple',
  Solid = 'solid',
  Ghost = 'ghost',
}

export enum SessionButtonShape {
  Round = 'round',
  Square = 'square',
  None = 'none',
}

// NOTE References ts/themes/colors.tsx
export enum SessionButtonColor {
  Green = 'green',
  Blue = 'blue',
  Yellow = 'yellow',
  Pink = 'pink',
  Purple = 'purple',
  Orange = 'orange',
  Red = 'red',
  White = 'white',
  Black = 'black',
  Grey = 'gray',
  Primary = 'primary',
  PrimaryDark = 'renderer-span-primary', // use primary in dark modes only since it has poor contrast in light mode
  Danger = 'danger',
  None = 'transparent',
}

type StyledButtonProps = {
  color: string | undefined;
  $buttonType: SessionButtonType;
  $buttonShape: SessionButtonShape;
  $fontWeight?: number;
  width?: string;
};

const StyledBaseButton = styled.button<StyledButtonProps>`
  width: ${props => props.width ?? 'auto'};
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: var(--font-size-md);
  font-weight: ${props => props.$fontWeight ?? 700};
  user-select: none;
  white-space: nowrap;
  cursor: pointer;
  transition: var(--default-duration);
  background-repeat: no-repeat;
  overflow: hidden;
  height: 34px;
  min-height: 34px;
  padding: 0px 18px;

  background-color: ${props => `var(--button-${props.$buttonType}-background-color)`};
  color: ${props =>
    props.color ? `var(--${props.color}-color)` : `var(--button-${props.$buttonType}-text-color)`};
  border-radius: ${props =>
    props.$buttonShape === SessionButtonShape.Round
      ? '17px'
      : props.$buttonShape === SessionButtonShape.Square
        ? '6px'
        : '0px'};

  .session-icon {
    fill: var(--background-primary-color);
  }

  & > *:hover:not(svg) {
    filter: brightness(80%);
  }

  &.disabled {
    cursor: not-allowed;
    outline: none;
    color: ${props => `var(--button-${props.$buttonType}-disabled-color)`};
  }

  &:not(.disabled) {
    &:hover {
      background-color: ${props => `var(--button-${props.$buttonType}-background-hover-color)`};
      color: ${props => `var(--button-${props.$buttonType}-text-hover-color)`};
    }
  }
`;

const StyledOutlineButton = styled(StyledBaseButton)`
  outline: none;
  ${props =>
    `border: 1px solid ${
      props.color ? `var(--${props.color}-color)` : 'var(--button-outline-border-color)'
    }`};

  &.disabled {
    border: 1px solid var(--button-outline-disabled-color);
  }

  &:not(.disabled) {
    &:hover {
      background-color: ${props =>
        props.color
          ? `var(--${props.color}-color)`
          : `var(--button-outline-background-hover-color)`};
      border: 1px solid
        ${props =>
          props.color ? `var(--${props.color}-color)` : 'var(--button-outline-border-hover-color)'};
    }
  }
`;

const StyledSolidButton = styled(StyledBaseButton)<{ isDarkTheme: boolean }>`
  outline: none;
  background-color: ${props =>
    props.color ? `var(--${props.color}-color)` : `var(--button-solid-background-color)`};
  color: ${props =>
    props.color && props.color !== SessionButtonColor.PrimaryDark && !props.isDarkTheme
      ? 'var(--text-primary-color)'
      : `var(--button-solid-text-color)`};
  border: 1px solid
    ${props =>
      props.color ? `var(--${props.color}-color)` : `var(--button-solid-background-color)`};

  &.disabled {
    background-color: var(--transparent-color);
    border: 1px solid var(--button-solid-disabled-color);
  }

  &:not(.disabled) {
    &:hover {
      background-color: var(--transparent-color);
      color: ${props =>
        props.isDarkTheme && props.color
          ? `var(--${props.color}-color)`
          : `var(--button-solid-text-hover-color)`};
      border: 1px solid
        ${props =>
          props.isDarkTheme && props.color
            ? `var(--${props.color}-color)`
            : `var(--button-solid-text-hover-color)`};
    }
  }
`;

const StyledGhostButton = styled(StyledBaseButton)`
  width: 100%;
  height: unset;
  min-height: unset;
  padding: 18px 24px 22px;
`;

export type SessionButtonProps = {
  text?: string;
  ariaLabel?: string;
  disabled?: boolean;
  buttonType?: SessionButtonType;
  buttonShape?: SessionButtonShape;
  buttonColor?: SessionButtonColor; // will override theme
  onClick?: any;
  children?: ReactNode;
  fontWeight?: number;
  width?: string;
  margin?: string;
  dataTestId?: SessionDataTestId;
  reference?: RefObject<HTMLButtonElement>;
  className?: string;
  style?: CSSProperties;
};

export const SessionButton = (props: SessionButtonProps) => {
  const isDarkTheme = useIsDarkTheme();

  const {
    buttonType = SessionButtonType.Outline,
    buttonShape = buttonType === SessionButtonType.Ghost
      ? SessionButtonShape.None
      : SessionButtonShape.Round,
    reference,
    className,
    dataTestId,
    buttonColor,
    text,
    ariaLabel,
    disabled = false,
    onClick = null,
    fontWeight,
    width,
    margin,
    style,
  } = props;

  const clickHandler = (e: any) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  const onClickFn = disabled ? () => null : clickHandler;

  const Comp =
    buttonType === SessionButtonType.Outline
      ? StyledOutlineButton
      : buttonType === SessionButtonType.Solid
        ? StyledSolidButton
        : buttonType === SessionButtonType.Ghost
          ? StyledGhostButton
          : StyledBaseButton;

  return (
    <Comp
      aria-label={ariaLabel}
      color={buttonColor}
      $buttonShape={buttonShape}
      $buttonType={buttonType}
      className={clsx(
        'session-button',
        buttonShape,
        buttonType,
        buttonColor ?? '',
        disabled && 'disabled',
        className
      )}
      role="button"
      isDarkTheme={isDarkTheme}
      onClick={onClickFn}
      ref={reference}
      data-testid={dataTestId}
      $fontWeight={fontWeight}
      width={width}
      style={{ ...style, margin }}
    >
      {props.children || text}
    </Comp>
  );
};
