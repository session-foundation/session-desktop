import { useEffect, useRef, type ReactNode } from 'react';
import { isEmpty } from 'lodash';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { type TrArgs } from '../../localization/localeTools';
import {
  BorderWithErrorState,
  type SessionInputTextSizes,
  SimpleErrorItem,
  StyledSessionInput,
  type GenericSessionInputProps,
} from './SessionInput';
import { useUpdateInputValue } from './useUpdateInputValue';
import { SpacerMD } from '../basic/Text';
import { focusVisibleOutline } from '../../styles/focusVisible';

export const StyledTextAreaContainer = styled(motion.div)<{
  $error: boolean;
  $textSize: SessionInputTextSizes;
  $monospaced?: boolean;
  $padding?: string;
}>`
  display: flex;
  align-items: center;
  position: relative;
  line-height: 1;
  height: 100%;
  width: 100%;
  padding: ${props => (props.$padding ? props.$padding : 'var(--margins-md)')};

  background: transparent;
  color: ${props => (props.$error ? 'var(--danger-color)' : 'var(--input-text-color)')};
  outline: 0;

  font-family: ${props => (props.$monospaced ? 'var(--font-mono)' : 'var(--font-default)')};
  ${props => `font-size: var(--font-size-${props.$textSize});`}

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
      font-family: ${props => (props.$monospaced ? 'var(--font-mono)' : 'var(--font-default)')};
      ${props => `font-size: var(--font-size-${props.$textSize});`}
    }

    &::placeholder {
      color: var(--text-secondary-color);
    }

    // we do not want --outline-focus-visible-small-offset to be applied here
    ${focusVisibleOutline('var(--margins-sm)')}
  }
`;

/**
 *
 * Also, and just like SimpleSessionInput, error handling and value management is to be done by the parent component.
 * Providing `error` will make the textarea red and the error string displayed below it.
 * This component should only be used for TextArea that does not need remote validations, as the error
 * state is live. For remote validations, use the SessionInput component.
 */
export const SimpleSessionTextarea = (
  props: Pick<
    GenericSessionInputProps,
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
    Required<Pick<GenericSessionInputProps, 'errorDataTestId'>> & {
      onValueChanged: (str: string) => void;
      providedError: string | TrArgs | undefined;
      disabled?: boolean;
      buttonEnd?: ReactNode;
      allowEscapeKeyPassthrough?: boolean;
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
    inputDataTestId,
    errorDataTestId,
    textSize = 'sm',
    disabled,
    padding,
    required,
    tabIndex,
    buttonEnd,
    allowEscapeKeyPassthrough,
  } = props;
  const hasError = !isEmpty(providedError);
  const hasValue = !isEmpty(value);

  const ref = useRef<HTMLTextAreaElement>(null);

  const updateInputValue = useUpdateInputValue(onValueChanged, disabled);

  const paddingInlineEnd = !!buttonEnd && hasValue ? '48px' : undefined;

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
      $error={hasError}
      $textSize={textSize}
    >
      <BorderWithErrorState hasError={hasError}>
        <StyledTextAreaContainer $error={hasError} $textSize={textSize} $padding={padding}>
          <textarea
            {...inputProps}
            placeholder={disabled ? value : placeholder}
            ref={ref}
            aria-label={ariaLabel}
            spellCheck={false} // maybe we should make this a prop, but it seems we never want spellcheck for those fields
            onKeyDown={e => {
              if (e.key === 'Escape' && allowEscapeKeyPassthrough) {
                return;
              }
              if (!props.singleLine) {
                e.stopPropagation();
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                props?.onEnterPressed();
              }

              e.stopPropagation();
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
