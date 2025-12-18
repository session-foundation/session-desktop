import {
  ChangeEvent,
  SessionDataTestId,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
} from 'react';
import { motion } from 'framer-motion';
import { isEmpty, isString } from 'lodash';
import styled from 'styled-components';
import { THEME_GLOBALS } from '../../themes/globals';
import { AnimatedFlex, Flex } from '../basic/Flex';
import { SpacerMD } from '../basic/Text';
import { Localizer } from '../basic/Localizer';
import { ShowHideButton, type ShowHideButtonProps } from './ShowHidePasswordButton';
import type { TrArgs } from '../../localization/localeTools';
import { useUpdateInputValue } from './useUpdateInputValue';
import { StyledTextAreaContainer } from './SimpleSessionTextarea';

export type SessionInputTextSizes = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const StyledSessionInput = styled(Flex) <{
  $error: boolean;
  $textSize: SessionInputTextSizes;
}>`
  position: relative;
  width: 100%;

  label {
    color: var(--text-primary-color);
    opacity: 0;
    transition: opacity var(--default-duration);
    text-align: center;

    &.filled {
      opacity: 1;
    }

    &.error {
      color: var(--danger-color);
      font-weight: 700;
      user-select: text;
    }
  }

  input::placeholder,
  textarea::placeholder {
    transition: opacity var(--default-duration) color var(--default-duration);
    ${props => props.$error && `color: var(--danger-color); opacity: 1;`}
  }

  ${props =>
    props.$textSize &&
    `
  ${StyledInput} {
    font-size: var(--font-size-${props.$textSize});
  }

  ${StyledTextAreaContainer} {
    font-size: var(--font-size-${props.$textSize});

    textarea {
      &:placeholder-shown {
        font-size: var(--font-size-${props.$textSize});
      }
    }
  }
  `}
`;

const StyledBorder = styled(AnimatedFlex) <{ $shape: 'round' | 'square' | 'none' }>`
  position: relative;
  border: 1px solid var(--input-border-color);
  border-radius: ${props =>
    props.$shape === 'none' ? '0px' : props.$shape === 'square' ? '7px' : '13px'};
`;

const StyledInput = styled(motion.input) <{
  $error: boolean;
  $textSize: SessionInputTextSizes;
  $centerText?: boolean;
  $monospaced?: boolean;
  $padding?: string;
}>`
  outline: 0;
  border: none;
  width: 100%;
  background: transparent;
  color: ${props => (props.$error ? 'var(--danger-color)' : 'var(--input-text-color)')};

  font-family: ${props => (props.$monospaced ? 'var(--font-mono)' : 'var(--font-default)')};
  line-height: 1.4;
  padding: ${props => (props.$padding ? props.$padding : 'var(--margins-lg)')};
  ${props => props.$centerText && 'text-align: center;'}
  ${props => `font-size: var(--font-size-${props.$textSize});`}

  &::placeholder {
    color: var(--input-text-placeholder-color);
    ${props => props.$centerText && 'text-align: center;'}
  }
`;

export function BorderWithErrorState({
  hasError,
  children,
}: { hasError: boolean } & PropsWithChildren) {
  const inputShape = 'round';
  return (
    <StyledBorder
      $shape={inputShape}
      width="100%"
      $container={true}
      $alignItems="center"
      initial={{
        borderColor: hasError ? 'var(--input-border-color)' : undefined,
      }}
      animate={{
        borderColor: hasError ? 'var(--danger-color)' : undefined,
      }}
      transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
    >
      {children}
    </StyledBorder>
  );
}

function usePaddingForButtonInlineEnd({ hasButtonInlineEnd }: { hasButtonInlineEnd?: boolean }) {
  return hasButtonInlineEnd ? '48px' : undefined;
}

/**
 * A simpler version of the ErrorItem component.
 * Only reacts to error, no caching.
 * So if you need a component that shows the error when provided, and hides it when not provided, use this.
 */
export const SimpleErrorItem = ({
  providedError,
  dataTestId,
}: {
  providedError: TrArgs | string | undefined;
  dataTestId: SessionDataTestId;
}) => {
  if (!providedError) {
    return null;
  }

  return (
    <motion.label
      aria-label="Error message"
      className={'filled error'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
      data-testid={dataTestId}
    >
      {isString(providedError) ? providedError : <Localizer {...providedError} />}
    </motion.label>
  );
};

export type GenericSessionInputProps = {
  error?: TrArgs | string;
  type?: 'text' | 'password';
  value?: string;
  placeholder?: string;
  ariaLabel?: string;
  maxLength?: number;
  onValueChanged?: (value: string) => any;
  onEnterPressed?: (value: string) => any;
  autoFocus?: boolean;
  disableOnBlurEvent?: boolean;
  inputDataTestId?: SessionDataTestId;
  errorDataTestId?: SessionDataTestId;
  monospaced?: boolean;
  textSize?: SessionInputTextSizes;
  centerText?: boolean;
  editable?: boolean;
  padding?: string;
  required?: boolean;
  tabIndex?: number;
  loading?: boolean;
};

type InputProps = Pick<
  GenericSessionInputProps,
  | 'type'
  | 'placeholder'
  | 'value'
  | 'textSize'
  | 'maxLength'
  | 'padding'
  | 'autoFocus'
  | 'required'
  | 'tabIndex'
> & {
  'data-testid'?: SessionDataTestId;
  'aria-required'?: boolean;
  style?: CSSProperties;
  disabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
};

type WithInputRef = { inputRef?: RefObject<HTMLInputElement | null> };

type SimpleSessionInputProps = Pick<
  GenericSessionInputProps,
  | 'type'
  | 'placeholder'
  | 'value'
  | 'ariaLabel'
  | 'maxLength'
  | 'autoFocus'
  | 'inputDataTestId'
  | 'textSize'
  | 'padding'
  | 'required'
  | 'tabIndex'
  | 'centerText'
> &
  WithInputRef &
  Required<Pick<GenericSessionInputProps, 'errorDataTestId'>> & {
    onValueChanged: (str: string) => void;
    onEnterPressed: () => void;
    providedError: string | TrArgs | undefined;
    disabled?: boolean;
    buttonEnd?: ReactNode;
  };

// NOTE: [react-compiler] this convinces the compiler the hook is static
const useUpdateInputValueInternal = useUpdateInputValue;

/**
 * A simpler version of the SessionInput component.
 * Does not handle CTA, textarea, nor monospaced fonts.
 *
 * Also, error handling and value management is to be done by the parent component.
 * Providing `error` will make the input red and the error string displayed below it.
 * This component should only be used for input that does not need remote validations, as the error
 * state is live. For remote validations, use the SessionInput component.
 */
export const SimpleSessionInput = (props: SimpleSessionInputProps) => {
  const {
    type = 'text',
    placeholder,
    value,
    ariaLabel,
    maxLength,
    providedError,
    onValueChanged,
    onEnterPressed,
    autoFocus,
    inputRef,
    inputDataTestId,
    errorDataTestId,
    textSize = 'sm',
    disabled,
    padding,
    required,
    tabIndex,
    centerText,
    buttonEnd,
  } = props;
  const hasError = !isEmpty(providedError);
  const hasValue = !isEmpty(value);

  const updateInputValue = useUpdateInputValueInternal(onValueChanged, disabled);

  const paddingInlineEnd = usePaddingForButtonInlineEnd({
    hasButtonInlineEnd: !!buttonEnd && hasValue,
  });

  const inputProps: InputProps = {
    type,
    placeholder,
    value,
    textSize,
    disabled,
    maxLength,
    padding,
    autoFocus,
    'data-testid': inputDataTestId,
    required,
    'aria-required': required,
    tabIndex,
    onChange: updateInputValue,
    style: { paddingInlineEnd, textAlign: centerText ? 'center' : undefined },
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (disabled) {
      return;
    }
    if (event.key === 'Enter' && onEnterPressed) {
      event.preventDefault();
      onEnterPressed();
    }
  };

  const containerProps = {
    $error: hasError,
    $textSize: textSize,
    $padding: padding,
  };

  return (
    <StyledSessionInput
      $container={true}
      $flexDirection="column"
      $justifyContent="center"
      $alignItems="center"
      $error={hasError}
      $textSize={textSize}
    >
      <BorderWithErrorState hasError={hasError}>
        <StyledInput
          {...inputProps}
          {...containerProps}
          onKeyDown={onKeyDown}
          ref={inputRef}
          aria-label={ariaLabel}
        />
        {buttonEnd}
      </BorderWithErrorState>

      {hasError ? (
        <>
          <SpacerMD />
          <SimpleErrorItem providedError={providedError} dataTestId={errorDataTestId} />
        </>
      ) : null}
    </StyledSessionInput>
  );
};

export const ModalSimpleSessionInput = (props: Omit<SimpleSessionInputProps, 'padding'>) => {
  return <SimpleSessionInput {...props} padding={'var(--margins-sm) var(--margins-md)'} />;
};

export function ShowHideSessionInput(
  props: Pick<
    SimpleSessionInputProps,
    | 'onEnterPressed'
    | 'onValueChanged'
    | 'placeholder'
    | 'value'
    | 'errorDataTestId'
    | 'inputDataTestId'
    | 'providedError'
    | 'ariaLabel'
    | 'padding'
  > & {
    showHideButtonAriaLabels: ShowHideButtonProps['ariaLabels'];
    showHideButtonDataTestIds: ShowHideButtonProps['dataTestIds'];
  }
) {
  const [forceShow, setForceShow] = useState(false);
  return (
    <SimpleSessionInput
      ariaLabel={props.ariaLabel}
      autoFocus={true}
      type={forceShow ? 'text' : 'password'}
      placeholder={props.placeholder}
      value={props.value}
      onValueChanged={props.onValueChanged}
      onEnterPressed={props.onEnterPressed}
      providedError={props.providedError}
      errorDataTestId={props.errorDataTestId}
      inputDataTestId={props.inputDataTestId}
      padding={props.padding}
      buttonEnd={
        <ShowHideButton
          forceShow={forceShow}
          toggleForceShow={() => {
            setForceShow(!forceShow);
          }}
          hasError={!!props.providedError}
          ariaLabels={props.showHideButtonAriaLabels}
          dataTestIds={props.showHideButtonDataTestIds}
        />
      }
    />
  );
}
