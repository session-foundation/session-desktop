import {
  ChangeEvent,
  RefObject,
  SessionDataTestId,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import { isEmpty, isEqual, isString } from 'lodash';
import styled from 'styled-components';
import { THEME_GLOBALS } from '../../themes/globals';
import { AnimatedFlex, Flex } from '../basic/Flex';
import { SpacerMD } from '../basic/Text';
import { Localizer, type LocalizerProps } from '../basic/Localizer';

type TextSizes = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const StyledSessionInput = styled(Flex)<{
  error: boolean;
  textSize: TextSizes;
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
    ${props => props.error && `color: var(--danger-color); opacity: 1;`}
  }

  ${props =>
    props.textSize &&
    `
  ${StyledInput} {
    font-size: var(--font-size-${props.textSize});
  }

  ${StyledTextAreaContainer} {
    font-size: var(--font-size-${props.textSize});

    textarea {
      &:placeholder-shown {
        font-size: var(--font-size-${props.textSize});
      }
    }
  }
  `}
`;

const StyledBorder = styled(AnimatedFlex)<{ shape: 'round' | 'square' | 'none' }>`
  position: relative;
  border: 1px solid var(--input-border-color);
  border-radius: ${props =>
    props.shape === 'none' ? '0px' : props.shape === 'square' ? '7px' : '13px'};
`;

const StyledInput = styled(motion.input)<{
  error: boolean;
  textSize: TextSizes;
  centerText?: boolean;
  monospaced?: boolean;
  padding?: string;
}>`
  outline: 0;
  border: none;
  width: 100%;
  background: transparent;
  color: ${props => (props.error ? 'var(--danger-color)' : 'var(--input-text-color)')};

  font-family: ${props => (props.monospaced ? 'var(--font-mono)' : 'var(--font-default)')};
  line-height: 1.4;
  padding: ${props => (props.padding ? props.padding : 'var(--margins-lg)')};
  ${props => props.centerText && 'text-align: center;'}
  ${props => `font-size: var(--font-size-${props.textSize});`}

  &::placeholder {
    color: var(--input-text-placeholder-color);
    ${props => props.centerText && 'text-align: center;'}
  }
`;

const StyledTextAreaContainer = styled(motion.div)<{
  error: boolean;
  textSize: TextSizes;
  centerText?: boolean;
  monospaced?: boolean;
  padding?: string;
}>`
  display: flex;
  align-items: center;
  position: relative;
  line-height: 1;
  height: 100%;
  width: 100%;
  padding: ${props => (props.padding ? props.padding : 'var(--margins-md)')};

  background: transparent;
  color: ${props => (props.error ? 'var(--danger-color)' : 'var(--input-text-color)')};
  outline: 0;

  font-family: ${props => (props.monospaced ? 'var(--font-mono)' : 'var(--font-default)')};
  ${props => `font-size: var(--font-size-${props.textSize});`}

  textarea {
    display: flex;
    height: 100%;
    width: 100%;
    outline: 0;
    border: none;
    background: transparent;

    resize: none;
    word-break: break-all;
    user-select: all;

    &:placeholder-shown {
      line-height: 1;
      font-family: ${props => (props.monospaced ? 'var(--font-mono)' : 'var(--font-default)')};
      ${props => `font-size: var(--font-size-${props.textSize});`}
    }

    &::placeholder {
      color: var(--input-text-placeholder-color);
    }
  }
`;

const ErrorItem = (props: {
  id: string;
  error: LocalizerProps | string | undefined;
  hasError: boolean;
  setHasError: (value: boolean) => void;
  setTextErrorStyle: (value: boolean) => void;
  loading?: boolean;
  dataTestId?: SessionDataTestId;
}) => {
  const { loading, error, hasError, setTextErrorStyle, setHasError, id } = props;
  const [errorValue, setErrorValue] = useState<LocalizerProps | string | undefined>(undefined);

  useEffect(() => {
    // if we have an error we want to continue to show that error unless it changes to a new error, we don't care if the input value changes
    if (error && !isEmpty(error)) {
      setTextErrorStyle(true);

      if (!isEqual(error, errorValue)) {
        setErrorValue(error);
        setHasError(true);
      }
    }

    // if the input value has been submitted somewhere check if we have an error and if we do clear it
    if (loading && hasError && errorValue && isEmpty(error)) {
      setErrorValue(undefined);
      setTextErrorStyle(false);
      setHasError(false);
    }
  }, [error, errorValue, hasError, loading, setHasError, setTextErrorStyle]);

  if (!errorValue) {
    return null;
  }

  return (
    <motion.label
      aria-label="Error message"
      htmlFor={id}
      className={'filled error'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
      data-testid={props.dataTestId || 'session-error-message'}
    >
      {isString(errorValue) ? errorValue : <Localizer {...errorValue} />}
    </motion.label>
  );
};

function BorderWithErrorState({ hasError, children }: { hasError: boolean } & PropsWithChildren) {
  const inputShape = 'round';
  return (
    <StyledBorder
      shape={inputShape}
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
const SimpleErrorItem = ({
  providedError,
  dataTestId,
}: {
  providedError: LocalizerProps | string | undefined;
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

type Props = {
  error?: LocalizerProps | string;
  type?: 'text' | 'password';
  value?: string;
  placeholder?: string;
  ariaLabel?: string;
  maxLength?: number;
  onValueChanged?: (value: string) => any;
  onEnterPressed?: (value: string) => any;
  autoFocus?: boolean;
  disableOnBlurEvent?: boolean;
  inputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement>;
  inputDataTestId?: SessionDataTestId;
  errorDataTestId?: SessionDataTestId;
  monospaced?: boolean;
  textSize?: TextSizes;
  centerText?: boolean;
  editable?: boolean;
  padding?: string;
  required?: boolean;
  tabIndex?: number;
  loading?: boolean;
};

export const SessionInput = (props: Props) => {
  const {
    placeholder,
    value,
    ariaLabel,
    maxLength,
    error,
    onValueChanged,
    onEnterPressed,
    autoFocus,
    disableOnBlurEvent,
    inputRef,
    inputDataTestId,
    errorDataTestId,
    monospaced,
    textSize = 'sm',
    centerText,
    editable = true,
    padding,
    required,
    tabIndex,
    loading,
  } = props;
  const [inputValue, setInputValue] = useState('');
  const [hasError, setHasError] = useState(false);
  const [textErrorStyle, setTextErrorStyle] = useState(false);
  const [isFocused, setIsFocused] = useState(props.autoFocus || false);

  const updateInputValue = (e: ChangeEvent<HTMLInputElement>) => {
    if (!editable) {
      return;
    }
    e.preventDefault();
    const val = e.target.value;
    setInputValue(val);
    setTextErrorStyle(false);
    if (onValueChanged) {
      onValueChanged(val);
    }
  };

  const id = 'session-input-floating-label';

  const inputProps: any = {
    type: 'text',
    placeholder,
    value,
    textSize,
    disabled: !editable,
    maxLength,
    padding,
    autoFocus,
    'data-testid': inputDataTestId,
    required,
    'aria-required': required,
    tabIndex,
    onChange: updateInputValue,
    // just in case onChange isn't triggered
    onBlur: (event: ChangeEvent<HTMLInputElement>) => {
      if (editable && !disableOnBlurEvent) {
        updateInputValue(event);
        if (isEmpty(value) && !autoFocus && isFocused) {
          setIsFocused(false);
        }
      }
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (!editable) {
        return;
      }
      if (event.key === 'Enter' && onEnterPressed) {
        event.preventDefault();
        onEnterPressed(inputValue);
      }
    },
  };

  const containerProps = {
    error: textErrorStyle,
    centerText,
    textSize,
    monospaced,
    padding,
  };

  return (
    <StyledSessionInput
      $container={true}
      $flexDirection="column"
      $justifyContent="center"
      $alignItems="center"
      error={hasError}
      textSize={textSize}
    >
      <BorderWithErrorState hasError={hasError}>
        <StyledInput
          {...inputProps}
          {...containerProps}
          ref={inputRef}
          aria-label={ariaLabel || 'session input'}
        />
      </BorderWithErrorState>

      {hasError ? <SpacerMD /> : null}
      <ErrorItem
        id={id}
        error={error}
        hasError={hasError}
        setHasError={setHasError}
        setTextErrorStyle={setTextErrorStyle}
        loading={loading}
        dataTestId={errorDataTestId}
      />
    </StyledSessionInput>
  );
};

function useUpdateInputValue(onValueChanged: (val: string) => void, disabled?: boolean) {
  return useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (disabled) {
        return;
      }
      e.preventDefault();
      const val = e.target.value;

      onValueChanged(val);
    },
    [disabled, onValueChanged]
  );
}

/**
 * A simpler version of the SessionInput component.
 * Does not handle CTA, textarea, nor monospaced fonts.
 *
 * Also, error handling and value management is to be done by the parent component.
 * Providing `error` will make the input red and the error string displayed below it.
 * This component should only be used for input that does not need remote validations, as the error
 * state is live. For remote validations, use the SessionInput component.
 */
export const SimpleSessionInput = (
  props: Pick<
    Props,
    | 'type'
    | 'placeholder'
    | 'value'
    | 'ariaLabel'
    | 'maxLength'
    | 'autoFocus'
    | 'inputRef'
    | 'inputDataTestId'
    | 'textSize'
    | 'padding'
    | 'required'
    | 'tabIndex'
    | 'centerText'
  > &
    Required<Pick<Props, 'errorDataTestId'>> & {
      onValueChanged: (str: string) => void;
      onEnterPressed: () => void;
      providedError: string | LocalizerProps | undefined;
      disabled?: boolean;
      buttonEnd?: ReactNode;
    }
) => {
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

  const updateInputValue = useUpdateInputValue(onValueChanged, disabled);

  const paddingInlineEnd = usePaddingForButtonInlineEnd({
    hasButtonInlineEnd: !!buttonEnd && hasValue,
  });

  const inputProps: any = {
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
    onKeyDown: (event: KeyboardEvent) => {
      if (disabled) {
        return;
      }
      if (event.key === 'Enter' && onEnterPressed) {
        event.preventDefault();
        onEnterPressed();
      }
    },
  };

  const containerProps = {
    error: hasError,
    textSize,
    padding,
  };

  return (
    <StyledSessionInput
      $container={true}
      $flexDirection="column"
      $justifyContent="center"
      $alignItems="center"
      error={hasError}
      textSize={textSize}
    >
      <BorderWithErrorState hasError={hasError}>
        <StyledInput {...inputProps} {...containerProps} ref={inputRef} aria-label={ariaLabel} />
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

/**
 * A simpler version of the SessionInput component as a TextArea.
 * Does not handle CTA, centered placeholder, nor monospaced fonts.
 *
 * Also, and just like SimpleSessionInput, error handling and value management is to be done by the parent component.
 * Providing `error` will make the textarea red and the error string displayed below it.
 * This component should only be used for TextArea that does not need remote validations, as the error
 * state is live. For remote validations, use the SessionInput component.
 */
export const SimpleSessionTextarea = (
  props: Pick<
    Props,
    | 'placeholder'
    | 'value'
    | 'ariaLabel'
    | 'maxLength'
    | 'autoFocus'
    | 'inputRef'
    | 'inputDataTestId'
    | 'textSize'
    | 'padding'
    | 'required'
    | 'tabIndex'
  > &
    Required<Pick<Props, 'errorDataTestId'>> & {
      onValueChanged: (str: string) => void;
      providedError: string | LocalizerProps | undefined;
      disabled?: boolean;
      buttonEnd?: ReactNode;
    } & ({ singleLine: false } | { singleLine: true; onEnterPressed: () => void })
) => {
  const {
    placeholder,
    value,
    ariaLabel,
    maxLength,
    providedError,
    onValueChanged,
    autoFocus,
    inputRef,
    inputDataTestId,
    errorDataTestId,
    textSize = 'sm',
    disabled,
    padding,
    required,
    tabIndex,
    buttonEnd,
  } = props;
  const hasError = !isEmpty(providedError);
  const hasValue = !isEmpty(value);

  const ref = useRef(inputRef?.current || null);

  const updateInputValue = useUpdateInputValue(onValueChanged, disabled);

  const paddingInlineEnd = usePaddingForButtonInlineEnd({
    hasButtonInlineEnd: !!buttonEnd && hasValue,
  });

  const inputProps: any = {
    type: 'text',
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
    style: { paddingInlineEnd, lineHeight: 1.5 },
  };

  const containerProps = {
    error: hasError,
    textSize,
    padding,
  };

  useEffect(() => {
    const textarea = ref.current;
    if (textarea) {
      // don't ask me why, but we need to reset the height to auto before calculating it here
      textarea.style.height = 'auto';
      // we want 12 lines of text at most
      textarea.style.height = `${Math.min(textarea.scrollHeight, 12 * parseFloat(getComputedStyle(textarea).lineHeight))}px`;
    }
  }, [ref, value]);

  return (
    <StyledSessionInput
      $container={true}
      $flexDirection="column"
      $justifyContent="center"
      $alignItems="center"
      error={hasError}
      textSize={textSize}
    >
      <BorderWithErrorState hasError={hasError}>
        <StyledTextAreaContainer {...containerProps}>
          <textarea
            {...inputProps}
            placeholder={disabled ? value : placeholder}
            ref={ref}
            aria-label={ariaLabel}
            spellCheck={false} // maybe we should make this a prop, but it seems we never want spellcheck for those fields
            onKeyDown={e => {
              if (!props.singleLine) {
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                props?.onEnterPressed();
              }
            }}
          />
        </StyledTextAreaContainer>

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
