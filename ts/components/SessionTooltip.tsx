import {
  type ReactNode,
  type RefObject,
  type SessionDataTestId,
  useRef,
  useState,
  useEffect,
} from 'react';
import styled, { type CSSProperties } from 'styled-components';
import useDebounce from 'react-use/lib/useDebounce';
import {
  type HorizontalAlignment,
  SessionPopoverContent,
  type VerticalPosition,
} from './SessionPopover';

const StyledTooltipTrigger = styled.div`
  position: relative;
  width: max-content;
  height: max-content;
`;

export type TooltipProps = {
  children: ReactNode;
  content: ReactNode;
  open?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  maxContentWidth?: string;
  loading?: boolean;
  style?: CSSProperties;
  dataTestId?: SessionDataTestId;
  verticalPosition?: VerticalPosition;
  horizontalPosition?: HorizontalAlignment;
  debounceTimeout?: number;
  containerMarginTop?: number;
  containerMarginBottom?: number;
  containerMarginLeft?: number;
  containerMarginRight?: number;
};

export type PopoverTriggerPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX?: number;
};

export const defaultTriggerPos: PopoverTriggerPosition = { x: 0, y: 0, width: 0, height: 0 };

export function getTriggerPositionFromBoundingClientRect(rect: DOMRect): PopoverTriggerPosition {
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export const getTriggerPositionFromId = (id: string): PopoverTriggerPosition => {
  const el = document.getElementById(id);
  if (!el) {
    return defaultTriggerPos;
  }
  return getTriggerPositionFromBoundingClientRect(el.getBoundingClientRect());
};

// Returns null if the ref is null
export const getTriggerPosition = (ref: RefObject<HTMLElement | null>) => {
  if (!ref.current) {
    return null;
  }
  return getTriggerPositionFromBoundingClientRect(ref.current.getBoundingClientRect());
};

// Returns null if the ref is null
export const useTriggerPosition = (
  ref: RefObject<HTMLElement | null>
): PopoverTriggerPosition | null => {
  return getTriggerPosition(ref);
};

export const SessionTooltip = ({
  children,
  content,
  onMouseEnter,
  onMouseLeave,
  maxContentWidth,
  open,
  loading = false,
  debounceTimeout = 150,
  style,
  dataTestId,
  verticalPosition,
  horizontalPosition,
  containerMarginBottom,
  containerMarginLeft,
  containerMarginRight,
  containerMarginTop,
}: TooltipProps) => {
  const [hovered, setHovered] = useState(false);
  const [debouncedHover, setDebouncedHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const getTriggerPos = () => {
    if (!ref.current) {
      return defaultTriggerPos;
    }
    return getTriggerPositionFromBoundingClientRect(ref.current.getBoundingClientRect());
  };

  useEffect(() => {
    if (!debouncedHover) {
      return;
    }

    const handleScroll = () => {
      setHovered(false);
      setDebouncedHover(false);
    };

    window.addEventListener('scroll', handleScroll, true);
    // eslint-disable-next-line consistent-return
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [debouncedHover]);

  useDebounce(
    () => {
      setDebouncedHover(hovered);
    },
    debounceTimeout,
    [hovered]
  );

  const isVisible = open || debouncedHover;

  return (
    <StyledTooltipTrigger
      ref={ref}
      onMouseEnter={() => {
        onMouseEnter?.();
        setHovered(true);
        setDebouncedHover(true);
      }}
      onMouseLeave={() => {
        onMouseLeave?.();
        setHovered(false);
      }}
      style={style}
      data-testid={dataTestId}
    >
      {children}
      <SessionPopoverContent
        triggerPosition={isVisible ? getTriggerPos() : defaultTriggerPos}
        open={isVisible}
        loading={loading}
        maxWidth={maxContentWidth}
        isTooltip={true}
        verticalPosition={verticalPosition}
        horizontalPosition={horizontalPosition}
        containerMarginBottom={containerMarginBottom}
        containerMarginTop={containerMarginTop}
        containerMarginLeft={containerMarginLeft}
        containerMarginRight={containerMarginRight}
      >
        {content}
      </SessionPopoverContent>
    </StyledTooltipTrigger>
  );
};
