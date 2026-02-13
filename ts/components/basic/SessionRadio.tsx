import { SessionDataTestId, type KeyboardEvent, type MouseEvent } from 'react';

import styled, { CSSProperties } from 'styled-components';
import { Flex } from './Flex';
import { createButtonOnKeyDownForClickEventHandler } from '../../util/keyboardShortcuts';

const StyledContainer = styled.div<{ disabled: boolean }>`
  cursor: ${props => (props.disabled ? 'not-allowed' : 'pointer')};
  min-height: 30px;
  background-color: var(--transparent-color);
  padding-block: var(--margins-sm);
`;

const StyledRadioOuter = styled.div<{
  $disabled: boolean;
  $selected: boolean;
  $diameterRadioBorder: number;
}>`
  width: ${props => props.$diameterRadioBorder}px;
  height: ${props => props.$diameterRadioBorder}px;
  border: 1px solid var(--radio-border-color, var(--text-primary-color));
  border-radius: 50%;

  cursor: ${props => (props.$disabled ? 'not-allowed' : 'pointer')};
  position: relative;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: ${props =>
      props.$disabled
        ? 'var(--disabled-color)'
        : 'radial-gradient(circle, var(--primary-color) 0%, var(--primary-color) 53%, transparent 60%, transparent 100%)'};
    opacity: ${props => (props.$selected ? 1 : 0)};
    transition: opacity 0.3s ease;
    pointer-events: none;
  }

  &:focus-visible {
    box-shadow: var(--box-shadow-focus-visible-inset);
  }
`;

/**
 * The dot part of the radio button. Unless for the Theme switcher, it shouldn't be used directly.
 * Instead, use `SessionRadio`.
 */
export function RadioDot({
  disabled,
  onClick,
  selected,
  dataTestId,
  diameterRadioBorder,
  style,
  ariaLabel,
  tabIndex = 1,
}: {
  selected: boolean;
  onClick: (e: KeyboardEvent<HTMLElement> | MouseEvent<HTMLElement>) => void;
  disabled: boolean;
  dataTestId: SessionDataTestId | undefined;
  diameterRadioBorder: number;
  style?: CSSProperties;
  ariaLabel?: string;
  tabIndex?: number;
}) {
  const onKeyDown = createButtonOnKeyDownForClickEventHandler(onClick);
  // clickHandler is on the parent button, so we need to skip this input while pressing Tab
  return (
    <StyledRadioOuter
      onClick={onClick}
      $disabled={disabled}
      tabIndex={tabIndex}
      data-testid={dataTestId}
      $diameterRadioBorder={diameterRadioBorder}
      style={style}
      aria-label={ariaLabel}
      data-checked={selected}
      data-disabled={disabled}
      $selected={selected}
      onKeyDown={onKeyDown}
    />
  );
}

// NOTE (): We don't use a transition because it's too slow and creates flickering when changing buttons.
const StyledLabel = styled.label<{
  $disabled: boolean;
}>`
  cursor: pointer;
  color: ${props => (props.$disabled ? 'var(--disabled-color)' : 'var(--text-primary-color)')};
  margin-inline-end: var(--margins-sm);
`;

type SessionRadioProps = {
  label?: string;
  value: string;
  active: boolean;
  inputName?: string;
  onClick?: (value: string) => void;
  disabled?: boolean;
  style?: CSSProperties;
  labelDataTestId?: SessionDataTestId;
  inputDataTestId?: SessionDataTestId;
  tabIndex?: number;
};

export const SessionRadio = (props: SessionRadioProps) => {
  const {
    label,
    value,
    active,
    onClick,
    disabled = false,
    style,
    labelDataTestId,
    inputDataTestId,
    tabIndex = -1,
  } = props;

  const clickHandler = (e: React.MouseEvent<any> | React.KeyboardEvent<any>) => {
    if (!disabled && onClick) {
      // let something else catch the event if our click handler is not set
      e.stopPropagation();
      onClick(value);
    }
  };

  const diameterRadioBorder = 26;
  const onKeyDown = createButtonOnKeyDownForClickEventHandler(clickHandler);

  return (
    <StyledContainer
      onKeyDown={onKeyDown}
      onClick={clickHandler}
      disabled={disabled}
      tabIndex={tabIndex}
    >
      <Flex
        $container={true}
        $flexDirection={'row'}
        $justifyContent={'flex-start'}
        style={{ ...style, alignItems: 'center', justifyContent: 'space-between' }}
      >
        {label ? (
          <StyledLabel
            role="button"
            onClick={clickHandler}
            aria-label={label}
            $disabled={disabled}
            data-testid={labelDataTestId}
          >
            {label}
          </StyledLabel>
        ) : null}

        <RadioDot
          selected={active}
          onClick={clickHandler}
          disabled={disabled}
          dataTestId={inputDataTestId}
          diameterRadioBorder={diameterRadioBorder}
          tabIndex={-1}
        />
      </Flex>
    </StyledContainer>
  );
};
