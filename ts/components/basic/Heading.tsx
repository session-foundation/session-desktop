import { ReactNode, type SessionDataTestId } from 'react';
import styled, { CSSProperties } from 'styled-components';

export type HeadingProps = {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
  /** center | start (left) | end (right) */
  alignText?: 'center' | 'start' | 'end';
  fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  padding?: string;
  margin?: string;
  dataTestId?: SessionDataTestId;
  onClick?: (event: React.MouseEvent<HTMLHeadingElement>) => void;
};

type StyledHeadingProps = HeadingProps & {
  size: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'h7' | 'h8' | 'h9';
};

const StyledHeading = styled.h1<StyledHeadingProps>`
  margin: ${props => props.margin || '0'};
  padding: ${props => props.padding || '0'};
  font-weight: ${props => props.fontWeight || '700'};
  ${props => props.size && `font-size: var(--font-size-${props.size});`}
  ${props => props.color && `color: ${props.color};`}
  ${props => props.alignText && `text-align: ${props.alignText};`}
  line-height: 1.0;
`;

const squashAsH6 = ['h6', 'h7', 'h8', 'h9'];

const Heading = (props: StyledHeadingProps) => {
  const tag = squashAsH6.includes(props.size) ? 'h6' : props.size;

  return (
    <StyledHeading as={tag} {...props} data-testid={props.dataTestId}>
      {props.children}
    </StyledHeading>
  );
};

/** --font-size-h1 30px */
export const H1 = (props: HeadingProps) => {
  return <Heading {...props} size="h1" />;
};

/** --font-size-h2 24px */
export const H2 = (props: HeadingProps) => {
  return <Heading {...props} size="h2" />;
};

/** --font-size-h3 20px */
export const H3 = (props: HeadingProps) => {
  return <Heading {...props} size="h3" />;
};

/** --font-size-h4 26px */
export const H4 = (props: HeadingProps) => {
  return <Heading {...props} size="h4" />;
};

/** --font-size-h5 23px */
export const H5 = (props: HeadingProps) => {
  return <Heading {...props} size="h5" />;
};

/** --font-size-h6 20px */
export const H6 = (props: HeadingProps) => {
  return <Heading {...props} size="h6" />;
};

/** --font-size-h7 18px */
export const H7 = (props: HeadingProps) => {
  return <Heading {...props} size="h7" />;
};

/** --font-size-h8 16px */
export const H8 = (props: HeadingProps) => {
  return <Heading {...props} size="h8" />;
};

/** --font-size-h9 14px */
export const H9 = (props: HeadingProps) => {
  return <Heading {...props} size="h9" />;
};
