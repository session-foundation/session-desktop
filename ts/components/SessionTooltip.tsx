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
import { isString } from 'lodash';
import { Localizer, type LocalizerProps } from './basic/Localizer';
import { SessionHtmlRenderer } from './basic/SessionHTMLRenderer';

type TipPosition = 'center' | 'left' | 'right';

const TIP_LENGTH = 22;

const StyledTooltip = styled.div<{
  tooltipPosition: TipPosition;
  readyToShow: boolean;
  x: number;
  y: number;
  maxWidth?: string;
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
    left: calc(50% - ${Math.floor(TIP_LENGTH / 2)}px);
  }
`;

type Props = {
  reference: RefObject<HTMLDivElement>;
  content: LocalizerProps | string;
  readyToShow: boolean;
  htmlString?: boolean;
  tooltipPosition?: TipPosition;
  x: number;
  y: number;
  maxWidth?: string;
  onClick?: (...args: Array<any>) => void;
};

const SessionTooltipContent = (props: Props) => {
  const {
    reference,
    content,
    readyToShow,
    htmlString,
    tooltipPosition = 'center',
    x,
    y,
    maxWidth,
    onClick,
  } = props;

  return (
    <StyledTooltip
      ref={reference}
      tooltipPosition={tooltipPosition}
      readyToShow={readyToShow}
      onClick={onClick}
      x={x}
      y={y}
      maxWidth={maxWidth}
    >
      {isString(content) ? (
        !htmlString ? (
          content
        ) : (
          <SessionHtmlRenderer html={content} />
        )
      ) : (
        <Localizer {...content} />
      )}
    </StyledTooltip>
  );
};

const StyledTooltipTrigger = styled.div`
  position: relative;
  width: fit-content;
  height: fit-content;
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
  htmlString,
}: {
  children: ReactNode;
  content: LocalizerProps | string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  maxContentWidth?: string;
  loading?: boolean;
  style?: CSSProperties;
  dataTestId?: SessionDataTestId;
  htmlString?: boolean;
}) => {
  const [readyToShow, setReadyToShow] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [debouncedHover, setDebouncedHover] = useState(false);
  const [x, setX] = useState<number>();
  const [y, setY] = useState<number>();

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
    const _x = triggerX - Math.floor(contentW / 2) + Math.floor(triggerW / 2);
    const _y = triggerY - triggerH - contentH;
    setX(_x);
    setY(_y);
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
          htmlString={htmlString}
          x={x}
          y={y}
          maxWidth={maxContentWidth}
        />
      ) : null}
    </StyledTooltipTrigger>
  );
};
