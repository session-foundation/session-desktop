import _ from 'lodash';
import { KeyboardEvent, MouseEvent, SessionDataTestId, ReactNode, forwardRef, memo } from 'react';
import type { CSSProperties } from 'styled-components';
import clsx from 'clsx';

import { StyledSessionIconButton } from './SessionIconButtonStyled';
import { SessionIcon, SessionIconProps } from './SessionIcon';
import { LucideIcon, type LucideIconProps } from './LucideIcon';
import { useIsDarkTheme } from '../../state/theme/selectors/theme';

export type SessionIconButtonProps = SessionIconProps & {
  onClick?: (e?: MouseEvent<HTMLButtonElement>) => void;
  isSelected?: boolean;
  isHidden?: boolean;
  margin?: string;
  dataTestId?: SessionDataTestId;
  dataTestIdIcon?: SessionDataTestId;
  padding?: string;
  id?: string;
  title?: string;
  ariaLabel?: string;
  tabIndex?: number;
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
};

// eslint-disable-next-line react/display-name
const SessionIconButtonInner = forwardRef<HTMLButtonElement, SessionIconButtonProps>(
  (props, ref) => {
    const {
      iconType,
      iconSize,
      iconColor,
      isSelected: $isSelected,
      isHidden,
      borderRadius,
      iconPadding,
      margin,
      padding,
      id,
      ariaLabel,
      title,
      dataTestId,
      dataTestIdIcon,
      style,
      tabIndex,
      className,
      children,
      disabled,
      backgroundColor,
    } = props;
    const clickHandler = (e: MouseEvent<HTMLButtonElement>) => {
      if (!disabled && props.onClick) {
        e.stopPropagation();
        props.onClick(e);
      }
    };
    const keyPressHandler = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.currentTarget.tabIndex > -1 && e.key === 'Enter' && !disabled && props.onClick) {
        e.stopPropagation();
        props.onClick();
      }
    };

    const isDarkTheme = useIsDarkTheme();

    return (
      <StyledSessionIconButton
        color={iconColor}
        $isSelected={$isSelected}
        className={clsx('session-icon-button', iconSize, className)}
        ref={ref}
        id={id}
        title={title}
        aria-label={ariaLabel}
        onClick={clickHandler}
        style={{
          ...style,
          display: style?.display ? style.display : isHidden ? 'none' : 'flex',
          margin: margin || '',
          padding: padding || '',
        }}
        tabIndex={tabIndex}
        onKeyDown={keyPressHandler}
        disabled={disabled}
        data-testid={dataTestId}
        $isDarkTheme={isDarkTheme}
      >
        <SessionIcon
          iconType={iconType}
          iconSize={iconSize}
          iconColor={iconColor}
          borderRadius={borderRadius}
          iconPadding={iconPadding}
          dataTestId={dataTestIdIcon}
          backgroundColor={backgroundColor}
        />
        {children}
      </StyledSessionIconButton>
    );
  }
);

export const SessionIconButton = memo(SessionIconButtonInner, _.isEqual);

export type SessionLucideIconButtonProps = Pick<
  SessionIconButtonProps,
  | 'onClick'
  | 'disabled'
  | 'isSelected'
  | 'margin'
  | 'padding'
  | 'ariaLabel'
  | 'title'
  | 'dataTestId'
  | 'dataTestIdIcon'
  | 'tabIndex'
  | 'children'
  // backgroundColor is a dedicated prop (forbidden from the `style` prop)
  | 'backgroundColor'
> &
  Pick<LucideIconProps, 'unicode' | 'iconSize' | 'iconColor'> & {
    // margin and backgroundColor have a dedicated prop
    style?: Omit<CSSProperties, 'backgroundColor' | 'margin' | 'padding'>;
  };

export const SessionLucideIconButton = forwardRef<HTMLButtonElement, SessionLucideIconButtonProps>(
  (props, ref) => {
    const {
      unicode,
      iconSize,
      isSelected: $isSelected,
      margin,
      padding,
      ariaLabel,
      title,
      dataTestId,
      dataTestIdIcon,
      style,
      iconColor,
      tabIndex,
      disabled,
      onClick,
      children,
      backgroundColor,
    } = props;

    const clickHandler = (e: MouseEvent<HTMLButtonElement>) => {
      if (!disabled && onClick) {
        e.stopPropagation();
        onClick(e);
      }
    };
    const keyPressHandler = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.currentTarget.tabIndex > -1 && e.key === 'Enter' && !disabled && onClick) {
        e.stopPropagation();
        onClick();
      }
    };
    const isDarkTheme = useIsDarkTheme();

    return (
      <StyledSessionIconButton
        color={iconColor}
        $isSelected={$isSelected}
        title={title}
        aria-label={ariaLabel}
        onClick={clickHandler}
        style={{
          ...style,
          backgroundColor,
          display: style?.display ? style.display : 'flex',
          margin: margin || '',
          padding: padding || '',
          // pretty sure we always want the border-radius here.
          borderRadius: '50%',
        }}
        tabIndex={tabIndex}
        onKeyDown={keyPressHandler}
        disabled={disabled}
        data-testid={dataTestId}
        ref={ref}
        $isDarkTheme={isDarkTheme}
      >
        <LucideIcon
          unicode={unicode}
          iconSize={iconSize}
          iconColor={iconColor}
          dataTestId={dataTestIdIcon}
        />
        {children}
      </StyledSessionIconButton>
    );
  }
);
