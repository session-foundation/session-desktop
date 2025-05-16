import { HTMLMotionProps, motion } from 'framer-motion';
import styled from 'styled-components';
import { HTMLDirection } from '../../util/i18n/rtlSupport';

export interface GridProps {
  children?: any;
  className?: string;
  $container?: boolean;
  // Grid Container Props
  $gridTemplateColumns?: string;
  $gridTemplateRows?: string;
  $gridTemplateAreas?: string;
  $gridAutoColumns?: string;
  $gridAutoRows?: string;
  $gridAutoFlow?: 'row' | 'column' | 'row dense' | 'column dense';
  $gridGap?: string;
  $gridColumnGap?: string;
  $gridRowGap?: string;
  $justifyItems?: 'start' | 'end' | 'center' | 'stretch';
  $alignItems?: 'stretch' | 'center' | 'start' | 'end' | 'baseline';
  $justifyContent?:
    | 'start'
    | 'end'
    | 'center'
    | 'stretch'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  $alignContent?:
    | 'start'
    | 'end'
    | 'center'
    | 'stretch'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  // Grid Item Props
  $gridColumn?: string;
  $gridRow?: string;
  $gridArea?: string;
  $justifySelf?: 'start' | 'end' | 'center' | 'stretch';
  $alignSelf?: 'start' | 'end' | 'center' | 'stretch' | 'baseline';
  $placeSelf?: string;
  $order?: number;
  // Common Layout Props
  padding?: string;
  margin?: string;
  width?: string;
  maxWidth?: string;
  minWidth?: string;
  height?: string;
  maxHeight?: string;
  minHeight?: string;
  overflow?: 'hidden' | 'visible' | 'scroll' | 'auto';
  // RTL support
  dir?: HTMLDirection;
  paddingInline?: string;
  paddingBlock?: string;
  marginInline?: string;
  marginBlock?: string;
}

export const Grid = styled.div<GridProps>`
  display: ${props => (props.$container ? 'grid' : 'block')};
  // Grid Container Properties
  grid-template-columns: ${props => props.$gridTemplateColumns || undefined};
  grid-template-rows: ${props => props.$gridTemplateRows || undefined};
  grid-template-areas: ${props => props.$gridTemplateAreas || undefined};
  grid-auto-columns: ${props => props.$gridAutoColumns || 'auto'};
  grid-auto-rows: ${props => props.$gridAutoRows || 'auto'};
  grid-auto-flow: ${props => props.$gridAutoFlow || 'row'};
  gap: ${props => props.$gridGap || undefined};
  column-gap: ${props => props.$gridColumnGap || undefined};
  row-gap: ${props => props.$gridRowGap || undefined};
  justify-items: ${props => props.$justifyItems || 'stretch'};
  align-items: ${props => props.$alignItems || 'stretch'};
  justify-content: ${props => props.$justifyContent || 'start'};
  align-content: ${props => props.$alignContent || 'stretch'};
  // Grid Item Properties
  grid-column: ${props => props.$gridColumn || 'auto'};
  grid-row: ${props => props.$gridRow || 'auto'};
  grid-area: ${props => props.$gridArea || undefined};
  justify-self: ${props => props.$justifySelf || 'auto'};
  align-self: ${props => props.$alignSelf || 'auto'};
  place-self: ${props => props.$placeSelf || 'auto'};
  order: ${props => props.$order || 0};
  // Common Layout Properties
  margin: ${props => props.margin || '0'};
  padding: ${props => props.padding || '0'};
  width: ${props => props.width || 'auto'};
  max-width: ${props => props.maxWidth || 'none'};
  min-width: ${props => props.minWidth || 'none'};
  height: ${props => props.height || 'auto'};
  max-height: ${props => props.maxHeight || 'none'};
  min-height: ${props => props.minHeight || 'none'};
  overflow: ${props => props.overflow || undefined};
  direction: ${props => props.dir || undefined};
  padding-inline: ${props => props.paddingInline || undefined};
  padding-block: ${props => props.paddingBlock || undefined};
  margin-inline: ${props => props.marginInline || undefined};
  margin-block: ${props => props.marginBlock || undefined};
`;

export const AnimatedGrid = styled(motion.div)<HTMLMotionProps<'div'> & GridProps>`
  display: ${props => (props.$container ? 'grid' : 'block')};
  // Grid Container Properties
  grid-template-columns: ${props => props.$gridTemplateColumns || undefined};
  grid-template-rows: ${props => props.$gridTemplateRows || undefined};
  grid-template-areas: ${props => props.$gridTemplateAreas || undefined};
  grid-auto-columns: ${props => props.$gridAutoColumns || 'auto'};
  grid-auto-rows: ${props => props.$gridAutoRows || 'auto'};
  grid-auto-flow: ${props => props.$gridAutoFlow || 'row'};
  gap: ${props => props.$gridGap || undefined};
  column-gap: ${props => props.$gridColumnGap || undefined};
  row-gap: ${props => props.$gridRowGap || undefined};
  justify-items: ${props => props.$justifyItems || 'stretch'};
  align-items: ${props => props.$alignItems || 'stretch'};
  justify-content: ${props => props.$justifyContent || 'start'};
  align-content: ${props => props.$alignContent || 'stretch'};
  // Grid Item Properties
  grid-column: ${props => props.$gridColumn || 'auto'};
  grid-row: ${props => props.$gridRow || 'auto'};
  grid-area: ${props => props.$gridArea || undefined};
  justify-self: ${props => props.$justifySelf || 'auto'};
  align-self: ${props => props.$alignSelf || 'auto'};
  place-self: ${props => props.$placeSelf || 'auto'};
  order: ${props => props.$order || 0};
  // Common Layout Properties
  margin: ${props => props.margin || '0'};
  padding: ${props => props.padding || '0'};
  width: ${props => props.width || 'auto'};
  max-width: ${props => props.maxWidth || 'none'};
  min-width: ${props => props.minWidth || 'none'};
  height: ${props => props.height || 'auto'};
  max-height: ${props => props.maxHeight || 'none'};
  min-height: ${props => props.minHeight || 'none'};
  overflow: ${props => props.overflow || undefined};
  direction: ${props => props.dir || undefined};
  padding-inline: ${props => props.paddingInline || undefined};
  padding-block: ${props => props.paddingBlock || undefined};
  margin-inline: ${props => props.marginInline || undefined};
  margin-block: ${props => props.marginBlock || undefined};
`;
