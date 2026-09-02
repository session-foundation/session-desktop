import styled from 'styled-components';
import { type ReactNode, useLayoutEffect, useMemo, useState } from 'react';
import { getFeatureFlagMemo } from '../state/ducks/types/releasedFeaturesReduxTypes';
import { clampNumber } from '../util/maths';
import { PopoverTriggerPosition } from './SessionTooltip';

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
  height: 4px;
  width: 4px;
  top: ${props => `${props.y + 2}px`};
  left: ${props => `${props.x - 2}px`};
`;

const StyledCoordinateRectangleMarker = styled.div<{
  $bounds: { x1: number; x2: number; y1: number; y2: number };
  color?: string;
}>`
  position: fixed;
  z-index: 9999;
  background-color: transparent;
  border: 2px solid ${props => props.color || 'red'};
  top: ${props => `${Math.min(props.$bounds.y1, props.$bounds.y2)}px`};
  left: ${props => `${Math.min(props.$bounds.x1, props.$bounds.x2)}px`};
  width: ${props => `${Math.abs(props.$bounds.x2 - props.$bounds.x1)}px`};
  height: ${props => `${Math.abs(props.$bounds.y2 - props.$bounds.y1)}px`};
  pointer-events: none;
`;

const StyledPopover = styled.div<{
  $readyToShow: boolean;
  x: number;
  y: number;
  $maxWidth?: string;
  $pointerOffset?: number;
  $tooltipStyles?: boolean;
  $borderRadius?: number;
  $verticalPosition?: VerticalPosition;
}>`
  background-color: var(--message-bubble-incoming-background-color);
  color: var(--message-bubble-incoming-text-color);
  box-shadow: 0px 0px 13px rgba(0, 0, 0, 0.51);
  font-size: var(--font-size-sm);
  overflow-wrap: break-word;

  border-radius: ${props => props.$borderRadius}px;
  z-index: 5;

  position: fixed;
  top: ${props => `${props.y}px`};
  left: ${props => `${props.x}px`};

  display: flex;
  justify-content: space-between;
  align-items: center;
  height: max-content;
  width: ${props => (props.$maxWidth ? '100%' : 'max-content')};
  max-width: ${props => props.$maxWidth || undefined};
  ${props => !props.$readyToShow && 'visibility: hidden;'}

  ${props => props.$tooltipStyles && 'padding: var(--margins-xs) var(--margins-md);'}

  ${props =>
    props.$tooltipStyles &&
    `&:after {
    content: '';
    width: ${TIP_LENGTH}px;
    height: ${TIP_LENGTH}px;
    background-color: var(--message-bubble-incoming-background-color);
    transform: rotate(45deg);
    border-radius: 5px;
    transform: scaleY(1.4) rotate(45deg);
    // 5.2px allows the tooltip triangle to wrap around the border radius slightly on its limits
    clip-path: ${props.$verticalPosition === 'bottom' ? 'polygon(0% 0%, 0px 60%, 60% 0px)' : 'polygon(100% 100%, 5.2px 100%, 100% 5.2px)'};
    position: absolute;
    ${props.$verticalPosition === 'bottom' ? 'top' : 'bottom'}: 0;
    left: ${props.$pointerOffset ?? 0}px;
  }`}
`;

export type PopoverProps = {
  children: ReactNode;
  pointerOffset?: number;
  triggerPosition: PopoverTriggerPosition | null;
  open: boolean;
  loading?: boolean;
  maxWidth?: string;
  onClick?: (...args: Array<any>) => void;
  className?: string;
  horizontalPosition?: HorizontalAlignment;
  verticalPosition?: VerticalPosition;
  isTooltip?: boolean;
  contentMargin?: number;
  containerMarginTop?: number;
  containerMarginBottom?: number;
  containerMarginLeft?: number;
  containerMarginRight?: number;
  // Fallbacks for when the content height and width are known, this
  // allows popovers to pre-calculate an initial position before the
  // content is rendered.
  fallbackContentHeight?: number;
  fallbackContentWidth?: number;
};

export const SessionPopoverContent = (props: PopoverProps) => {
  const {
    children,
    className,
    open,
    loading,
    maxWidth,
    onClick,
    triggerPosition,
    isTooltip,
    contentMargin = 0,
    containerMarginTop = VIEWPORT_MARGIN,
    containerMarginBottom = VIEWPORT_MARGIN,
    containerMarginLeft = VIEWPORT_MARGIN,
    containerMarginRight = VIEWPORT_MARGIN,
    horizontalPosition = 'center',
    verticalPosition = 'top',
    fallbackContentHeight,
    fallbackContentWidth,
  } = props;
  const showPopoverAnchors = getFeatureFlagMemo('showPopoverAnchors');

  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);

  /**
   * Where the popover goes depends on how big it is, and that is only knowable once it has been laid
   * out. Reading the size off a ref during render answers with the PREVIOUS render's size — nothing at
   * all on the first one — and a ref read schedules no re-render, so a popover that mounted before its
   * content had a size kept the position computed for a 0x0 box until something unrelated happened to
   * re-render it. Observing the element instead makes the measurement a state change, so the position
   * follows the content, including when the content resizes under it.
   */
  useLayoutEffect(() => {
    if (!content) {
      setMeasured(null);
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      setMeasured({ width: content.offsetWidth, height: content.offsetHeight });
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
    };
  }, [content]);

  const contentWidth = measured?.width;
  const contentHeight = measured?.height;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const show = open && !loading && !!triggerPosition;

  /**
   * Until the size is known the computed position is not a position at all, just the trigger's own
   * coordinates — which is to say, on top of whatever the popover was meant to sit clear of. Stay
   * hidden until the content has been measured, unless the caller supplied the size up front.
   */
  const positioned =
    !!(contentWidth && contentHeight) || !!(fallbackContentWidth && fallbackContentHeight);

  const { x, y, pointerOffset, anchorX, finalVerticalPos, bounds } = useMemo(() => {
    if (!show) {
      return {
        x: 0,
        y: 0,
        pointerOffset: 0,
        anchorX: 0,
        finalVerticalPos: verticalPosition,
        finalHorizontalPos: horizontalPosition,
        bounds: { x1: 0, x2: 0, y1: 0, y2: 0 },
      };
    }

    let verticalPos = verticalPosition;
    const horizontalPos = horizontalPosition;

    const contentW = contentWidth || (fallbackContentWidth ?? 0);
    const contentH = contentHeight || (fallbackContentHeight ?? 0);

    const minX = containerMarginLeft;
    const maxX = viewportWidth - containerMarginRight;

    const minY = containerMarginTop;
    const maxY = viewportHeight - containerMarginBottom;

    const coreContentWidth = contentW - (isTooltip ? CONTENT_BORDER_RADIUS : 0);
    const margin = isTooltip ? TIP_MARGIN : contentMargin;

    const newAnchorX =
      triggerPosition.x + triggerPosition.width / 2 + (triggerPosition.offsetX ?? 0);
    let newX = newAnchorX;
    if (horizontalPosition === 'left') {
      newX -= coreContentWidth;
    } else if (horizontalPosition === 'center') {
      newX -= Math.floor(contentW / 2);
    } else if (horizontalPosition === 'right' && isTooltip) {
      newX -= TIP_LENGTH;
    }

    const topAlignY = triggerPosition.y - contentH - margin;
    const bottomAlignY = triggerPosition.y + triggerPosition.height + margin;

    if (verticalPos === 'top') {
      // NOTE: we only want to change to bottom if its actually better than top,
      // if both are bad, we stick with the default.
      if (topAlignY < minY && bottomAlignY - contentH < maxY) {
        verticalPos = 'bottom';
      }
    } else if (verticalPos === 'bottom') {
      if (bottomAlignY + contentH > maxY) {
        verticalPos = 'top';
      }
    }

    const newY = verticalPos === 'bottom' ? bottomAlignY : topAlignY;

    const clampedX = clampNumber(newX, minX, maxX - contentW);
    const clampedY = clampNumber(newY, minY, maxY - contentH);

    const offset = newAnchorX - clampedX - (isTooltip ? TIP_LENGTH / 2 : 0);

    return {
      x: clampedX,
      y: clampedY,
      pointerOffset: offset,
      anchorX: newAnchorX,
      finalVerticalPos: verticalPos,
      finalHorizontalPos: horizontalPos,
      bounds: { x1: minX, y1: minY, x2: maxX, y2: maxY },
    };
  }, [
    show,
    contentWidth,
    isTooltip,
    triggerPosition,
    horizontalPosition,
    viewportWidth,
    verticalPosition,
    contentHeight,
    viewportHeight,
    fallbackContentWidth,
    fallbackContentHeight,
    contentMargin,
    containerMarginTop,
    containerMarginBottom,
    containerMarginLeft,
    containerMarginRight,
  ]);

  return (
    <>
      <StyledPopover
        ref={setContent}
        $readyToShow={show && positioned}
        onClick={onClick}
        x={x}
        y={y}
        $maxWidth={maxWidth}
        className={className}
        $pointerOffset={pointerOffset}
        $tooltipStyles={isTooltip}
        $borderRadius={CONTENT_BORDER_RADIUS}
        $verticalPosition={finalVerticalPos}
      >
        {children}
      </StyledPopover>
      {showPopoverAnchors && show ? (
        // NOTE: these are only rendered when the debug option is enabled
        <>
          <StyledCoordinateRectangleMarker title="allowedArea" $bounds={bounds} />
          <StyledCoordinateRectangleMarker
            title="triggerArea"
            color="orange"
            $bounds={{
              x1: triggerPosition.x,
              x2: triggerPosition.x + triggerPosition.width,
              y1: triggerPosition.y,
              y2: triggerPosition.y + triggerPosition.height,
            }}
          />
          <StyledCoordinateRectangleMarker
            title="popoverContentArea"
            color="purple"
            $bounds={{
              x1: x,
              x2: x + (contentWidth || (fallbackContentWidth ?? 0)),
              y1: y,
              y2: y + (contentHeight || (fallbackContentHeight ?? 0)),
            }}
          />
          {isTooltip ? (
            <>
              <StyledCoordinateMarker
                x={x + pointerOffset}
                y={
                  y + (contentHeight ?? 0) * (verticalPosition === 'top' ? 1 : -1) - TIP_LENGTH / 2
                }
                title="offset"
                color="green"
              />
              <StyledCoordinateMarker
                x={x + pointerOffset + TIP_LENGTH / 2}
                y={
                  y +
                  (contentHeight ?? 0) * (verticalPosition === 'top' ? 1 : -1) +
                  (verticalPosition === 'bottom' ? triggerPosition.height : 0)
                }
                title="offset-center"
                color="green"
              />
            </>
          ) : null}
          <StyledCoordinateMarker
            x={anchorX}
            y={triggerPosition.y}
            title="anchorX"
            color="purple"
          />
          <StyledCoordinateMarker
            x={triggerPosition.x}
            y={triggerPosition.y}
            title="triggerPos"
            color="red"
          />
          <StyledCoordinateMarker x={x} y={y} title="anchorPos" color="blue" />
        </>
      ) : null}
    </>
  );
};
