import styled from 'styled-components';
import { type ReactNode, useMemo, useRef } from 'react';
import { getFeatureFlag } from '../state/ducks/types/releasedFeaturesReduxTypes';

const TIP_LENGTH = 18;
const VIEWPORT_MARGIN = 4;
const TIP_MARGIN = 12;
const CONTENT_BORDER_RADIUS = 16;

export type VerticalPosition = 'top' | 'bottom';
export type HorizontalAlignment = 'left' | 'center' | 'right';

const StyledCoordinateMarker = styled.div<{
  x: number;
  y: number;
  color?: string;
}>`
  position: fixed;
  z-index: 9999;
  background-color: ${props => props.color || 'red'};
  height: 3px;
  width: 3px;
  top: ${props => `${props.y + 1.5}px`};
  left: ${props => `${props.x - 1.5}px`};
`;

const StyledPopover = styled.div<{
  readyToShow: boolean;
  x: number;
  y: number;
  maxWidth?: string;
  pointerOffset?: number;
  tooltipStyles?: boolean;
  borderRadius?: number;
  verticalPosition?: VerticalPosition;
}>`
  background-color: var(--message-bubbles-received-background-color);
  color: var(--message-bubbles-received-text-color);
  box-shadow: 0px 0px 13px rgba(0, 0, 0, 0.51);
  font-size: var(--font-size-sm);
  overflow-wrap: break-word;

  border-radius: ${props => props.borderRadius}px;
  cursor: pointer;
  z-index: 5;

  position: fixed;
  top: ${props => `${props.y}px`};
  left: ${props => `${props.x}px`};

  display: flex;
  justify-content: space-between;
  align-items: center;
  height: max-content;
  width: ${props => (props.maxWidth ? '100%' : 'max-content')};
  max-width: ${props => props.maxWidth || undefined};
  ${props => !props.readyToShow && 'visibility: hidden;'}

  ${props => props.tooltipStyles && 'padding: var(--margins-xs) var(--margins-md);'}

  ${props =>
    props.tooltipStyles &&
    `&:after {
    content: '';
    width: ${TIP_LENGTH}px;
    height: ${TIP_LENGTH}px;
    background-color: var(--message-bubbles-received-background-color);
    transform: rotate(45deg);
    border-radius: 5px;
    transform: scaleY(1.4) rotate(45deg);
    // 5.2px allows the tooltip triangle to wrap around the border radius slightly on its limits
    clip-path: ${props.verticalPosition === 'bottom' ? 'polygon(0% 0%, 0px 60%, 60% 0px)' : 'polygon(100% 100%, 5.2px 100%, 100% 5.2px)'};
    position: absolute;
    ${props.verticalPosition === 'bottom' ? 'top' : 'bottom'}: 0;
    left: ${props.pointerOffset ?? 0}px;
  }`}
`;

export type PopoverProps = {
  children: ReactNode;
  pointerOffset?: number;
  triggerX: number;
  triggerY: number;
  triggerWidth: number;
  triggerHeight: number;
  open: boolean;
  loading?: boolean;
  maxWidth?: string;
  onClick?: (...args: Array<any>) => void;
  className?: string;
  horizontalPosition?: HorizontalAlignment;
  verticalPosition?: VerticalPosition;
  isTooltip?: boolean;
};

export const SessionPopoverContent = (props: PopoverProps) => {
  const {
    children,
    className,
    open,
    loading,
    maxWidth,
    onClick,
    triggerX,
    triggerY,
    triggerWidth,
    triggerHeight,
    isTooltip,
    horizontalPosition = 'center',
    verticalPosition = 'top',
  } = props;

  const showPopoverAnchors = getFeatureFlag('useShowPopoverAnchors');

  const ref = useRef<HTMLDivElement | null>(null);

  const contentW = ref.current?.offsetWidth;
  const contentH = ref.current?.offsetHeight;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const readyToShow = !!(!loading && contentW && contentH && open);

  const { x, y, pointerOffset, anchorX } = useMemo(() => {
    if (!readyToShow) {
      return {
        x: 0,
        y: 0,
        pointerOffset: 0,
        anchorX: 0,
      };
    }

    const coreContentWidth = contentW - CONTENT_BORDER_RADIUS;

    const newAnchorX = triggerX + triggerWidth / 2;

    let newX = newAnchorX;
    if (horizontalPosition === 'left') {
      newX -= coreContentWidth;
    } else if (horizontalPosition === 'center') {
      newX -= Math.floor(contentW / 2);
    } else if (horizontalPosition === 'right') {
      newX -= TIP_LENGTH;
    }

    /**
     * Clamp horizontally within viewport.
     * If `x` is too far left, set `x` to the left margin.
     * If `x` is too far right, set `x` to the right margin minus the content width.
     *
     * NOTE: the tooltip content `x` anchor is on the left of the tooltip content
     */
    if (newX < VIEWPORT_MARGIN) {
      newX = VIEWPORT_MARGIN;
    } else if (newX + contentW + VIEWPORT_MARGIN > viewportWidth) {
      newX = viewportWidth - contentW - VIEWPORT_MARGIN;
    }

    let newY = 0;
    if (verticalPosition === 'bottom') {
      newY = triggerY + triggerHeight + TIP_MARGIN;
    } else {
      newY = triggerY - contentH - TIP_MARGIN;
    }

    /**
     * If `y + contentHeight` is above the viewport, position the tooltip content below the trigger.
     */
    if (newY < VIEWPORT_MARGIN) {
      newY = triggerY + triggerHeight + VIEWPORT_MARGIN;
    }

    if (newY + contentH + VIEWPORT_MARGIN > viewportHeight) {
      newY = viewportHeight - contentH - VIEWPORT_MARGIN;
    }

    // const halfContentWidth = Math.floor(contentW / 2)

    const offset = newAnchorX - newX - TIP_LENGTH / 2;
    /**
     *  we want the triangle’s center (TIP_LENGTH/2) to land under triggerCenterX. Because the content
     *  has a border radius, the offset needs to be capped at the edge of the border radius.
     */
    // const pointerMinOffset= CONTENT_BORDER_RADIUS;
    // const pointerMaxOffset= contentW - CONTENT_BORDER_RADIUS - TIP_LENGTH/2;

    // if (horizontalPosition === 'left') {
    //   offset = Math.min(offset + halfContentWidth, pointerMaxOffset)
    // } else if (horizontalPosition === 'right') {
    //   offset = Math.max(offset - halfContentWidth, pointerMinOffset)
    // }

    // const offset = Math.min(
    //   triggerCenterX - newX - TIP_LENGTH / 2,
    //   horizontalPosition === 'left' ? CONTENT_BORDER_RADIUS : contentW - CONTENT_BORDER_RADIUS
    // );

    return {
      x: newX,
      y: newY,
      pointerOffset: offset,
      anchorX: newAnchorX,
    };
  }, [
    contentH,
    contentW,
    readyToShow,
    triggerHeight,
    triggerWidth,
    triggerX,
    triggerY,
    viewportWidth,
    viewportHeight,
    verticalPosition,
    horizontalPosition,
  ]);

  return (
    <>
      <StyledPopover
        ref={ref}
        readyToShow={readyToShow}
        onClick={onClick}
        x={x}
        y={y}
        maxWidth={maxWidth}
        className={className}
        pointerOffset={pointerOffset}
        tooltipStyles={isTooltip}
        borderRadius={CONTENT_BORDER_RADIUS}
        verticalPosition={verticalPosition}
      >
        {children}
      </StyledPopover>
      {showPopoverAnchors ? (
        <>
          <StyledCoordinateMarker x={x} y={y} title="x,y" />
          <StyledCoordinateMarker
            x={x + pointerOffset}
            y={y + (contentH ?? 0) * (verticalPosition === 'top' ? 1 : -1) - TIP_LENGTH / 2}
            title="offset"
            color="green"
          />
          <StyledCoordinateMarker
            x={x + pointerOffset + TIP_LENGTH / 2}
            y={
              y +
              (contentH ?? 0) * (verticalPosition === 'top' ? 1 : -1) +
              (verticalPosition === 'bottom' ? triggerHeight : 0)
            }
            title="offset-center"
            color="green"
          />
          <StyledCoordinateMarker
            x={anchorX}
            y={triggerY - triggerHeight * (verticalPosition === 'top' ? 1 : -1)}
            title="anchorX"
            color="blue"
          />
        </>
      ) : null}
    </>
  );
};
