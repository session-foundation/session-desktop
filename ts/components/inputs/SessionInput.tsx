import {
  ChangeEvent,
  ReactNode,
  RefObject,
  SessionDataTestId,
  useEffect,
  useRef,
  useState,
} from 'react';

import { motion } from 'framer-motion';
import { isEmpty, isEqual, isString } from 'lodash';
import styled, { CSSProperties } from 'styled-components';
import { THEME_GLOBALS } from '../../themes/globals';
import { AnimatedFlex, Flex } from '../basic/Flex';
import { SpacerMD } from '../basic/Text';
import { SessionIconButton } from '../icon';
import { useHTMLDirection } from '../../util/i18n/rtlSupport';
import { Localizer } from '../basic/Localizer';
import type { LocalizerComponentPropsObject } from '../../localization/localeTools';

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

export const StyledTextAreaContainer = styled(motion.div)<{
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

const StyledPlaceholder = styled(motion.div)<{
  error: boolean;
  textSize: TextSizes;
  editable: boolean;
  centerText?: boolean;
  monospaced?: boolean;
  padding?: string;
}>`
  position: relative;
  width: 100%;
  height: 100%;
  transition: opacity var(--default-duration) color var(--default-duration);
  ${props => props.editable && 'cursor: pointer;'}
  line-height: 1;

  ${props => props.editable && 'cursor: pointer;'}
  ${props => !props.centerText && props.padding && `padding: ${props.padding};`}

  background: transparent;
  color: ${props =>
    props.error
      ? 'var(--danger-color)'
      : props.editable
        ? 'var(--input-text-placeholder-color)'
        : 'var(--input-text-color)'};

  font-family: ${props => (props.monospaced ? 'var(--font-mono)' : 'var(--font-default)')};
  font-size: ${props => `var(--font-size-${props.textSize})`};
  ${props =>
    props.centerText &&
    'text-align: center; display: flex; align-items: center; justify-content: center;'}
`;

const ErrorItem = (props: {
  id: string;
  error: LocalizerComponentPropsObject | string | undefined;
  hasError: boolean;
  setHasError: (value: boolean) => void;
  setTextErrorStyle: (value: boolean) => void;
  loading?: boolean;
  dataTestId?: SessionDataTestId;
}) => {
  const [errorValue, setErrorValue] = useState<LocalizerComponentPropsObject | string | undefined>(
    undefined
  );

  useEffect(() => {
    // if we have an error we want to continue to show that error unless it changes to a new error, we dont care if the input value changes
    if (props.error && !isEmpty(props.error) && !isEqual(props.error, errorValue)) {
      setErrorValue(props.error);
      props.setTextErrorStyle(true);
      props.setHasError(true);
    }

    // if the input value has been submitted somewhere check if we have an error and if we do clear it
    if (props.loading && props.hasError && errorValue && isEmpty(props.error)) {
      setErrorValue(undefined);
      props.setTextErrorStyle(false);
      props.setHasError(false);
    }
  }, [errorValue, props]);

  if (!errorValue) {
    return null;
  }

  return (
    <motion.label
      aria-label="Error message"
      htmlFor={props.id}
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

type ShowHideButtonStrings<T extends string> = { hide: T; show: T };
type ShowHideButtonProps = {
  forceShow: boolean;
  toggleForceShow: () => void;
  error: boolean;
  ariaLabels?: ShowHideButtonStrings<string>;
  dataTestIds?: ShowHideButtonStrings<SessionDataTestId>;
};

const ShowHideButton = (props: ShowHideButtonProps) => {
  const {
    forceShow,
    toggleForceShow,
    error,
    ariaLabels = { hide: 'Hide input text button', show: 'Show input text button' },
    dataTestIds = { hide: 'hide-input-text-toggle', show: 'show-input-text-toggle' },
  } = props;

  const htmlDirection = useHTMLDirection();
  const style: CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    left: htmlDirection === 'ltr' ? undefined : 'var(--margins-sm)',
    right: htmlDirection === 'ltr' ? 'var(--margins-sm)' : undefined,
  };

  if (forceShow) {
    return (
      <SessionIconButton
        ariaLabel={ariaLabels.hide}
        iconType={'eyeDisabled'}
        iconColor={error ? 'var(--danger-color)' : 'var(--text-primary-color)'}
        iconSize="huge"
        onClick={toggleForceShow}
        style={style}
        dataTestId={dataTestIds.hide}
      />
    );
  }

  return (
    <SessionIconButton
      ariaLabel={ariaLabels.show}
      iconType={'eye'}
      iconColor={props.error ? 'var(--danger-color)' : 'var(--text-primary-color)'}
      iconSize="huge"
      onClick={toggleForceShow}
      style={style}
      dataTestId={dataTestIds.show}
    />
  );
};

const StyledCtaContainer = styled(motion.div)`
  width: 100%;
`;

type Props = {
  error?: LocalizerComponentPropsObject | string;
  type?: string;
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
  id?: string;
  enableShowHideButton?: boolean;
  showHideButtonAriaLabels?: ShowHideButtonStrings<string>;
  showHideButtonDataTestIds?: ShowHideButtonStrings<SessionDataTestId>;
  ctaButton?: ReactNode;
  monospaced?: boolean;
  textSize?: TextSizes;
  centerText?: boolean;
  editable?: boolean;
  isTextArea?: boolean;
  inputShape?: 'round' | 'square' | 'none';
  padding?: string;
  required?: boolean;
  tabIndex?: number;
  loading?: boolean;
  className?: string;
};

export const SessionInput = (props: Props) => {
  const {
    placeholder,
    type = 'text',
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
    id = 'session-input-floating-label',
    enableShowHideButton,
    showHideButtonAriaLabels,
    showHideButtonDataTestIds,
    ctaButton,
    monospaced,
    textSize = 'sm',
    centerText,
    editable = true,
    isTextArea,
    inputShape = 'round',
    padding,
    required,
    tabIndex,
    loading,
    className,
  } = props;
  const [inputValue, setInputValue] = useState('');
  const [hasError, setHasError] = useState(false);
  const [textErrorStyle, setTextErrorStyle] = useState(false);
  const [forceShow, setForceShow] = useState(false);
  const [isFocused, setIsFocused] = useState(props.autoFocus || false);

  const textAreaRef = useRef(inputRef?.current || null);

  const correctType = forceShow ? 'text' : type;

  const updateInputValue = (e: ChangeEvent<HTMLInputElement>) => {
    if (!editable) {
      return;
    }
    e.preventDefault();
    const val = e.target.value;
    setInputValue(val);
    setTextErrorStyle(false);
    if (isTextArea && textAreaRef && textAreaRef.current !== null) {
      const scrollHeight = `${textAreaRef.current.scrollHeight}px`;
      if (!autoFocus && isEmpty(val)) {
        // resets the height of the text area so it's centered if we clear the text
        textAreaRef.current.style.height = 'unset';
      }
      if (scrollHeight !== textAreaRef.current.style.height) {
        textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
      }
    }
    if (onValueChanged) {
      onValueChanged(val);
    }
  };

  const inputProps: any = {
    id,
    type: correctType,
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
    style: { paddingInlineEnd: enableShowHideButton ? '48px' : undefined },
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
        if (isTextArea && event.shiftKey) {
          return;
        }
        event.preventDefault();
        onEnterPressed(inputValue);
      }
    },
  };

  const containerProps = {
    noValue: isEmpty(value),
    error: textErrorStyle,
    centerText,
    textSize,
    monospaced,
    padding,
  };

  useEffect(() => {
    if (isTextArea && editable && isFocused && textAreaRef && textAreaRef.current !== null) {
      textAreaRef.current.focus();
    }
  }, [editable, isFocused, isTextArea]);

  return (
    <StyledSessionInput
      className={className}
      $container={true}
      $flexDirection="column"
      $justifyContent="center"
      $alignItems="center"
      error={hasError}
      textSize={textSize}
    >
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
        {isTextArea ? (
          <StyledTextAreaContainer {...containerProps}>
            {isFocused ? (
              <textarea
                {...inputProps}
                placeholder={!autoFocus ? '' : editable ? placeholder : value}
                ref={inputRef || textAreaRef}
                aria-label={ariaLabel || 'session input text area'}
              />
            ) : (
              <StyledPlaceholder
                error={textErrorStyle}
                data-testid={inputDataTestId}
                textSize={textSize}
                editable={editable}
                centerText={centerText}
                monospaced={monospaced}
                padding={padding}
                onClick={() => {
                  if (editable) {
                    setIsFocused(true);
                  }
                }}
              >
                {editable ? placeholder : value}
              </StyledPlaceholder>
            )}
          </StyledTextAreaContainer>
        ) : (
          <StyledInput
            {...inputProps}
            {...containerProps}
            ref={inputRef}
            aria-label={ariaLabel || 'session input'}
          />
        )}
        {editable && enableShowHideButton && (
          <ShowHideButton
            forceShow={forceShow}
            toggleForceShow={() => {
              setForceShow(!forceShow);
            }}
            error={hasError}
            ariaLabels={showHideButtonAriaLabels}
            dataTestIds={showHideButtonDataTestIds}
          />
        )}
      </StyledBorder>

      {ctaButton || hasError ? <SpacerMD /> : null}
      <ErrorItem
        id={id}
        error={error}
        hasError={hasError}
        setHasError={setHasError}
        setTextErrorStyle={setTextErrorStyle}
        loading={loading}
        dataTestId={errorDataTestId}
      />

      <StyledCtaContainer
        initial={{ y: hasError && ctaButton ? 0 : undefined }}
        animate={{ y: hasError && ctaButton ? 'var(--margins-md)' : undefined }}
      >
        {ctaButton}
      </StyledCtaContainer>
    </StyledSessionInput>
  );
};
