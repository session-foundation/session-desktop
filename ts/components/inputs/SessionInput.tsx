import {
  ChangeEvent,
  SessionDataTestId,
  useCallback,
  useEffect,
  useRef,
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

type InputProps = Pick<
  Props,
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

type WithInputRef = { inputRef?: RefObject<HTMLInputElement> };
type WithTextAreaRef = { inputRef?: RefObject<HTMLTextAreaElement> };

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
    | 'inputDataTestId'
    | 'textSize'
    | 'padding'
    | 'required'
    | 'tabIndex'
    | 'centerText'
  > &
    WithInputRef &
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

/**
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
    | 'inputDataTestId'
    | 'textSize'
    | 'padding'
    | 'required'
    | 'tabIndex'
  > &
    WithTextAreaRef &
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
                e.stopPropagation();
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
