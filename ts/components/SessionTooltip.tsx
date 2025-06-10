import styled from 'styled-components';

import useMouse from 'react-use/lib/useMouse';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type SessionDataTestId,
} from 'react';
import useDebounce from 'react-use/lib/useDebounce';
import type { CSSProperties } from 'styled-components';

const TIP_LENGTH = 22;
const VIEWPORT_MARGIN = 8;

const StyledTooltip = styled.div<{
  readyToShow: boolean;
  x: number;
  y: number;
  maxWidth?: string;
  pointerOffset?: number;
}>`
  background-color: var(--message-bubbles-received-background-color);
  color: var(--message-bubbles-received-text-color);
  box-shadow: 0px 0px 13px rgba(0, 0, 0, 0.51);
  font-size: 12px;
  overflow-wrap: break-word;
  padding: 8px 16px;
  border-radius: 24px;
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
  ${props => !props.readyToShow && 'visibility: hidden;'};

  &:after {
    content: '';
    width: ${TIP_LENGTH}px;
    height: ${TIP_LENGTH}px;
    background-color: var(--message-bubbles-received-background-color);
    transform: rotate(45deg);
    border-radius: 3px;
    transform: scaleY(1.4) rotate(45deg);
    clip-path: polygon(100% 100%, 7.2px 100%, 100% 7.2px);
    position: absolute;
    bottom: 0;
    left: ${({ pointerOffset }) => `${pointerOffset ?? 0}px`};
  }
`;

type Props = {
  reference: RefObject<HTMLDivElement>;
  content: ReactNode;
  pointerOffset?: number;
  readyToShow: boolean;
  x: number;
  y: number;
  maxWidth?: string;
  onClick?: (...args: Array<any>) => void;
};

const SessionTooltipContent = (props: Props) => {
  const { reference, content, readyToShow, x, y, pointerOffset, maxWidth, onClick } = props;

  return (
    <StyledTooltip
      ref={reference}
      readyToShow={readyToShow}
      onClick={onClick}
      x={x}
      y={y}
      maxWidth={maxWidth}
      pointerOffset={pointerOffset}
    >
      {content}
    </StyledTooltip>
  );
};

const StyledTooltipTrigger = styled.div`
  position: relative;
  width: max-content;
  height: max-content;
`;

export const SessionTooltip = ({
  children,
  content,
  onMouseEnter,
  onMouseLeave,
  maxContentWidth,
  loading = false,
  style,
  dataTestId,
}: {
  children: ReactNode;
  content: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  maxContentWidth?: string;
  loading?: boolean;
  style?: CSSProperties;
  dataTestId?: SessionDataTestId;
}) => {
  const [readyToShow, setReadyToShow] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [debouncedHover, setDebouncedHover] = useState(false);
  const [x, setX] = useState<number>();
  const [y, setY] = useState<number>();
  const [pointerOffset, setPointerOffset] = useState<number>();

  useDebounce(
    () => {
      setDebouncedHover(hovered);
    },
    150,
    [hovered]
  );

  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { posX: triggerX, posY: triggerY, elH: triggerH, elW: triggerW } = useMouse(triggerRef);
  const { elW: contentW, elH: contentH } = useMouse(contentRef);

  const updatePosition = useCallback(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Center horizontally on the trigger
    let newX = triggerX - Math.floor(contentW / 2) + Math.floor(triggerW / 2);

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

    // Position the content above the trigger.
    let newY = triggerY - triggerH - contentH;

    /**
     * Position the content above the trigger.
     * If `y + contentHeight` is above the viewport, position the tooltip content below the trigger.
     */
    if (newY < VIEWPORT_MARGIN) {
      newY = triggerY + triggerH + VIEWPORT_MARGIN;
    }

    if (newY + contentH + VIEWPORT_MARGIN > viewportHeight) {
      newY = viewportHeight - contentH - VIEWPORT_MARGIN;
    }

    setX(newX);
    setY(newY);

    const triggerCenterX = triggerX + triggerW / 2;
    // we want the triangle’s center (TIP_LENGTH/2) to land under triggerCenterX
    const offset = triggerCenterX - newX - TIP_LENGTH / 2;
    setPointerOffset(offset);
  }, [contentH, contentW, triggerH, triggerW, triggerX, triggerY]);

  useEffect(() => {
    if (!loading && !readyToShow && contentW && contentH) {
      updatePosition();
      setReadyToShow(true);
    }
  }, [contentH, contentW, loading, readyToShow, updatePosition]);

  useEffect(() => {
    if (debouncedHover) {
      updatePosition();
    }
  }, [debouncedHover, updatePosition]);

  return (
    <StyledTooltipTrigger
      ref={triggerRef}
      onMouseEnter={() => {
        if (onMouseEnter) {
          onMouseEnter();
        }
        setHovered(true);
        setDebouncedHover(true);
      }}
      onMouseLeave={() => {
        if (onMouseLeave) {
          onMouseLeave();
        }
        setHovered(false);
      }}
      style={style}
      data-testid={dataTestId}
    >
      {children}
      {debouncedHover && x && y ? (
        <SessionTooltipContent
          reference={contentRef}
          content={content}
          readyToShow={readyToShow}
          x={x}
          y={y}
          maxWidth={maxContentWidth}
          pointerOffset={pointerOffset}
        />
      ) : null}
    </StyledTooltipTrigger>
  );
};
