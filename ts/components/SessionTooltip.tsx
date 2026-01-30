import { type ReactNode, type RefObject, type SessionDataTestId, useRef, useState } from 'react';
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
};

export type PopoverTriggerPosition = {
  triggerX: number;
  triggerY: number;
  triggerWidth: number;
  triggerHeight: number;
};

export const defaultTriggerPos = { triggerX: 0, triggerY: 0, triggerWidth: 0, triggerHeight: 0 };

function getTriggerPositionFromBoundingClientRect(rect: DOMRect) {
  return {
    triggerX: rect.left,
    triggerY: rect.top,
    triggerWidth: rect.width,
    triggerHeight: rect.height,
  };
}

export const getTriggerPositionFromId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) {
    return defaultTriggerPos;
  }
  return getTriggerPositionFromBoundingClientRect(el.getBoundingClientRect());
};

export const useTriggerPosition = (ref: RefObject<HTMLElement | null>) => {
  if (!ref.current) {
    return defaultTriggerPos;
  }
  return getTriggerPositionFromBoundingClientRect(ref.current.getBoundingClientRect());
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
}: TooltipProps) => {
  const [hovered, setHovered] = useState(false);
  const [debouncedHover, setDebouncedHover] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const triggerPos = useTriggerPosition(ref);

  useDebounce(
    () => {
      setDebouncedHover(hovered);
    },
    debounceTimeout,
    [hovered]
  );

  return (
    <StyledTooltipTrigger
      ref={ref}
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
      <SessionPopoverContent
        {...triggerPos}
        open={open || debouncedHover}
        loading={loading}
        maxWidth={maxContentWidth}
        isTooltip={true}
        verticalPosition={verticalPosition}
        horizontalPosition={horizontalPosition}
      >
        {content}
      </SessionPopoverContent>
    </StyledTooltipTrigger>
  );
};
