import { HTMLMotionProps, motion } from 'framer-motion';
import styled from 'styled-components';
import { HTMLDirection } from '../../util/i18n/rtlSupport';

export interface FlexProps {
  children?: any;
  className?: string;
  $container?: boolean;
  // Container Props
  $flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  $justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'
    | 'initial'
    | 'inherit';
  $flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
  $flexGap?: string;
  $alignItems?:
    | 'stretch'
    | 'center'
    | 'flex-start'
    | 'flex-end'
    | 'baseline'
    | 'initial'
    | 'inherit';
  // Child Props
  $flexGrow?: number;
  $flexShrink?: number;
  $flexBasis?: number;
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
  overflowX?: 'hidden' | 'visible' | 'scroll' | 'auto';
  overflowY?: 'hidden' | 'visible' | 'scroll' | 'auto';
  // RTL support
  dir?: HTMLDirection;
  paddingInline?: string;
  paddingBlock?: string;
  marginInline?: string;
  marginBlock?: string;
}

export const Flex = styled.div<FlexProps>`
  display: ${props => (props.$container ? 'flex' : 'block')};
  justify-content: ${props => props.$justifyContent || 'flex-start'};
  flex-direction: ${props => props.$flexDirection || 'row'};
  flex-grow: ${props => (props.$flexGrow !== undefined ? props.$flexGrow : '0')};
  flex-basis: ${props => (props.$flexBasis !== undefined ? props.$flexBasis : 'auto')};
  flex-shrink: ${props => (props.$flexShrink !== undefined ? props.$flexShrink : '1')};
  flex-wrap: ${props => (props.$flexWrap !== undefined ? props.$flexWrap : 'nowrap')};
  gap: ${props => props.$flexGap || undefined};
  align-items: ${props => props.$alignItems || 'stretch'};
  margin: ${props => props.margin || '0'};
  padding: ${props => props.padding || '0'};
  width: ${props => props.width || 'auto'};
  max-width: ${props => props.maxWidth || 'none'};
  min-width: ${props => props.minWidth || 'none'};
  height: ${props => props.height || 'auto'};
  max-height: ${props => props.maxHeight || 'none'};
  min-height: ${props => props.minHeight || 'none'};
  overflow: ${props => (props.overflow !== undefined ? props.overflow : undefined)};
  overflow-x: ${props => (props.overflowX !== undefined ? props.overflowX : undefined)};
  overflow-y: ${props => (props.overflowY !== undefined ? props.overflowY : undefined)};
  direction: ${props => props.dir || undefined};
  padding-inline: ${props => props.paddingInline || undefined};
  padding-block: ${props => props.paddingBlock || undefined};
  margin-inline: ${props => props.marginInline || undefined};
  margin-block: ${props => props.marginBlock || undefined};
`;

export const AnimatedFlex = styled(motion.div)<HTMLMotionProps<'div'> & FlexProps>`
  display: ${props => (props.$container ? 'flex' : 'block')};
  justify-content: ${props => props.$justifyContent || 'flex-start'};
  flex-direction: ${props => props.$flexDirection || 'row'};
  flex-grow: ${props => (props.$flexGrow !== undefined ? props.$flexGrow : '0')};
  flex-basis: ${props => (props.$flexBasis !== undefined ? props.$flexBasis : 'auto')};
  flex-shrink: ${props => (props.$flexShrink !== undefined ? props.$flexShrink : '1')};
  flex-wrap: ${props => (props.$flexWrap !== undefined ? props.$flexWrap : 'nowrap')};
  gap: ${props => props.$flexGap || undefined};
  align-items: ${props => props.$alignItems || 'stretch'};
  margin: ${props => props.margin || '0'};
  padding: ${props => props.padding || '0'};
  width: ${props => props.width || 'auto'};
  max-width: ${props => props.maxWidth || 'none'};
  min-width: ${props => props.minWidth || 'none'};
  height: ${props => props.height || 'auto'};
  max-height: ${props => props.maxHeight || 'none'};
  min-height: ${props => props.minHeight || 'none'};
  overflow: ${props => (props.overflow !== undefined ? props.overflow : undefined)};
  direction: ${props => props.dir || undefined};
  padding-inline: ${props => props.paddingInline || undefined};
  padding-block: ${props => props.paddingBlock || undefined};
  margin-inline: ${props => props.marginInline || undefined};
  margin-block: ${props => props.marginBlock || undefined};
`;
