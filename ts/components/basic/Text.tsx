import { ReactNode } from 'react';
import styled, { CSSProperties } from 'styled-components';

type TextProps = {
  text: string;
  subtle?: boolean;
  maxWidth?: string;
  padding?: string;
  textAlign?: 'center';
  ellipsisOverflow?: boolean;
};

const StyledDefaultText = styled.div<Omit<TextProps, 'text'>>`
  transition: var(--default-duration);
  max-width: ${props => (props.maxWidth ? props.maxWidth : '')};
  padding: ${props => (props.padding ? props.padding : '')};
  text-align: ${props => (props.textAlign ? props.textAlign : '')};
  font-family: var(--font-default);
  color: ${props => (props.subtle ? 'var(--text-secondary-color)' : 'var(--text-primary-color)')};
  white-space: ${props => (props.ellipsisOverflow ? 'nowrap' : null)};
  overflow: ${props => (props.ellipsisOverflow ? 'hidden' : null)};
  text-overflow: ${props => (props.ellipsisOverflow ? 'ellipsis' : null)};
`;

export const Text = (props: TextProps) => {
  return <StyledDefaultText {...props}>{props.text}</StyledDefaultText>;
};

export const TextWithChildren = (props: Omit<TextProps, 'text'> & { children: ReactNode }) => {
  return <StyledDefaultText {...props}>{props.children}</StyledDefaultText>;
};

type SpacerProps = {
  size: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  style?: CSSProperties;
};
const SpacerStyled = styled.div<SpacerProps>`
  width: ${props => `var(--margins-${props.size})`};
  height: ${props => `var(--margins-${props.size})`};
`;

const Spacer = (props: SpacerProps) => {
  return <SpacerStyled {...props} data-testid={`spacer-${props.size}`} />;
};

/** --margins-xxs 2.5px */
export const SpacerXXS = (props: { style?: CSSProperties }) => {
  return <Spacer size="xxs" style={props.style} />;
};

/** --margins-xs 5px */
export const SpacerXS = (props: { style?: CSSProperties }) => {
  return <Spacer size="xs" style={props.style} />;
};

/** --margins-sm 10px */
export const SpacerSM = (props: { style?: CSSProperties }) => {
  return <Spacer size="sm" style={props.style} />;
};

/** --margins-md 15px */
export const SpacerMD = (props: { style?: CSSProperties }) => {
  return <Spacer size="md" style={props.style} />;
};

/** --margins-lg 20px */
export const SpacerLG = (props: { style?: CSSProperties }) => {
  return <Spacer size="lg" style={props.style} />;
};

/** --margins-xl 25px */
export const SpacerXL = (props: { style?: CSSProperties }) => {
  return <Spacer size="xl" style={props.style} />;
};

/** --margins-2xl 30px */
export const Spacer2XL = (props: { style?: CSSProperties }) => {
  return <Spacer size="2xl" style={props.style} />;
};

/** --margins-3xl 35px */
export const Spacer3XL = (props: { style?: CSSProperties }) => {
  return <Spacer size="3xl" style={props.style} />;
};

export const HintText = ({ children }: { children: string }) => {
  return (
    <span
      style={{
        color: 'var(--renderer-span-primary-color)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: 400,
        marginInlineStart: 'var(--margins-xs)',
      }}
    >
      <strong>•</strong> {children}
    </span>
  );
};

export const StringCollapser = ({
  str,
  leadingChars = 6,
  trailingChars = 4,
  separatorStyle,
}: {
  str: string;
  leadingChars?: number;
  trailingChars?: number;
  separatorStyle?: CSSProperties;
}) => {
  if (str.length <= leadingChars + trailingChars + 3) {
    return <>{str}</>;
  }

  return (
    <span>
      {str.slice(0, leadingChars)}
      <span style={separatorStyle}>…</span>
      {str.slice(-trailingChars)}
    </span>
  );
};
