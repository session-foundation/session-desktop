import {
  type MouseEventHandler,
  type MouseEvent,
  type RefObject,
  useCallback,
  useRef,
} from 'react';
import { debounce } from 'lodash';

function selectAllContent(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);

  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

interface DebouncedSelectAllOnTripleClickHandlerProps {
  elementRef: RefObject<HTMLDivElement | HTMLInputElement | HTMLTextAreaElement>;
  onClick?: MouseEventHandler;
}

/**
 * Create a triple click select all onClick handler which will track the number of clicks that the
 * element has had in a short timespan.
 * NOTE: This will call the `onClick` after the triple click handler if passed to this hook.
 * @param elementRef - The element to handle clicks for.
 * @param onClick - An optional onClick handler to execute after the triple click selection logic.
 */
export const useDebouncedSelectAllOnTripleClickHandler = ({
  elementRef,
  onClick,
}: DebouncedSelectAllOnTripleClickHandlerProps) => {
  const clickCount = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: see if we can create our own useDebounce hook
  const resetClickCount = useCallback(
    debounce(() => {
      clickCount.current = 0;
    }, 300),
    []
  );

  return useCallback(
    (e: MouseEvent<HTMLDivElement | HTMLInputElement | HTMLTextAreaElement>) => {
      if (!elementRef.current) {
        return;
      }

      resetClickCount.cancel();
      if (clickCount.current === 2) {
        // If count is 2 we know this new click is 3 so select all content and reset
        e.preventDefault();
        selectAllContent(elementRef.current);
        clickCount.current = 0;
      } else {
        clickCount.current += 1;
        resetClickCount();
      }
      onClick?.(e);
    },
    [elementRef, resetClickCount, onClick]
  );
};
