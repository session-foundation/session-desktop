import { type ReactNode, type RefObject, type SessionDataTestId, useRef, useState } from 'react';
import styled, { type CSSProperties } from 'styled-components';
import useMouse from 'react-use/lib/useMouse';
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

export const useTriggerPosition = (ref: RefObject<Element>) => {
  const { posX: triggerX, posY: triggerY, elH: triggerHeight, elW: triggerWidth } = useMouse(ref);
  return { triggerX, triggerY, triggerWidth, triggerHeight };
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

  const ref = useRef<HTMLDivElement | null>(null);

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
