import { memo, SessionDataTestId } from 'react';
import styled, { CSSProperties } from 'styled-components';

import { SessionIconSize, SessionIconType } from '.';

import { ClipRule, FillRule, icons } from './Icons';

export type SessionIconProps = {
  iconType: SessionIconType;
  /**
   * iconSize is usually the height of the icon, we then have a ratio for each icons to calculate the width.
   * see sizeIsWidth for how to do the opposite */
  iconSize: SessionIconSize | number;
  iconColor?: string;
  iconPadding?: string;
  glowDuration?: number;
  borderRadius?: string;
  backgroundColor?: string;
  dataTestId?: SessionDataTestId;
  style?: CSSProperties;
  unreadCount?: number;
  /** for some use cases, we want to fix the width of the icon and have the height be calculated from the ratio of the icon */
  sizeIsWidth?: boolean;
};

export const IconSizeToPx = {
  tiny: 12,
  small: 15,
  /**
   * medium is default
   */
  medium: 20,
  large: 25,
  huge: 30,
  huge2: 40,
  max: 50,
};

export const IconSizeToPxStr = {
  small: `${IconSizeToPx.small}px`,
  medium: `${IconSizeToPx.medium}px`,
  large: `${IconSizeToPx.large}px`,
  huge: `${IconSizeToPx.huge}px`,
  huge2: `${IconSizeToPx.huge2}px`,
  max: `${IconSizeToPx.max}px`,
};

const getIconDimensionFromIconSize = (iconSize: SessionIconSize | number) => {
  if (typeof iconSize === 'number') {
    return iconSize;
  }
  switch (iconSize) {
    case 'small':
      return IconSizeToPx.small;
    case 'medium':
      return IconSizeToPx.medium;
    case 'large':
      return IconSizeToPx.large;
    case 'huge':
      return IconSizeToPx.huge;
    case 'huge2':
      return IconSizeToPx.huge2;
    default:
      return IconSizeToPx.medium;
  }
};

type StyledSvgProps = {
  width: string | number;
  height: string | number;
  borderRadius?: string;
  $iconPadding?: string;
  $iconColor?: string;
  backgroundColor?: string;
  fill?: string;
  clipRule?: ClipRule;
  fillRule?: FillRule;
};

const Svg = memo(styled.svg<StyledSvgProps>`
  width: ${props => props.width};
  border-radius: ${props => props.borderRadius};
  background-color: ${props =>
    props.backgroundColor ? props.backgroundColor : 'var(--button-icon-background-color)'};
  fill: ${props => (props.$iconColor ? props.$iconColor : 'var(--button-icon-stroke-color)')};
  padding: ${props => (props.$iconPadding ? props.$iconPadding : '')};
  transition: inherit;
`);

const SessionSvg = (
  props: StyledSvgProps & {
    viewBox: string;
    path: string | Array<string>;
    style?: CSSProperties;
    dataTestId?: SessionDataTestId;
  }
) => {
  const colorSvg = props.$iconColor ? props.$iconColor : 'var(--button-icon-stroke-color)';
  const pathArray = props.path instanceof Array ? props.path : [props.path];
  const propsToPick = {
    width: props.width,
    height: props.height,
    viewBox: props.viewBox,
    $iconColor: props.$iconColor,
    backgroundColor: props.backgroundColor,
    borderRadius: props.borderRadius,
    $iconPadding: props.$iconPadding,
    fill: props.fill,
    clipRule: props.clipRule,
    fillRule: props.fillRule,
    style: props.style,
    dataTestId: props.dataTestId,
  };

  return (
    <Svg data-testid={props.dataTestId} {...propsToPick}>
      {pathArray.map((path, index) => {
        return <path key={index} fill={colorSvg} d={path} />;
      })}
    </Svg>
  );
};

export const SessionIcon = (props: SessionIconProps) => {
  const {
    iconType,
    iconColor,
    borderRadius,
    backgroundColor,
    iconPadding,
    style,
    dataTestId,
    sizeIsWidth,
  } = props;
  let { iconSize } = props;
  iconSize = iconSize || 'medium';

  const calculatedIconSize = getIconDimensionFromIconSize(iconSize);
  const iconDef = icons[iconType];
  const ratio = iconDef.ratio;
  const fill = iconDef?.fill || undefined;
  const clipRule = iconDef?.clipRule || 'nonzero';
  const fillRule = iconDef?.fillRule || 'nonzero';

  const width = sizeIsWidth ? calculatedIconSize : calculatedIconSize * ratio;
  const height = sizeIsWidth ? calculatedIconSize / ratio : calculatedIconSize;

  return (
    <SessionSvg
      viewBox={iconDef.viewBox}
      path={iconDef.path}
      width={width}
      height={height}
      borderRadius={borderRadius}
      $iconColor={iconColor}
      backgroundColor={backgroundColor}
      $iconPadding={iconPadding}
      fill={fill}
      clipRule={clipRule}
      fillRule={fillRule}
      style={style}
      dataTestId={dataTestId}
    />
  );
};
