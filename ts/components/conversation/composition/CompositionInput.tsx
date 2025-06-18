import React, {
  useRef,
  useLayoutEffect,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import styled from 'styled-components';

/**
 * Compute the HTML-based character index of the caret in `el`.
 * @param el - Html element to get the carat index for.
 */
function getHtmlIndexFromSelection(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) {
    return 0;
  }
  const range = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  const fragment = pre.cloneContents();
  const wrap = document.createElement('div');
  wrap.appendChild(fragment);
  return wrap.innerHTML.length;
}

/**
 * Move the caret to `index` within the HTML content of `el`.
 * @param el - Html element to set the carat for.
 * @param idx - Html index to set the carat to.
 */
function setCaretAtHtmlIndex(el: HTMLElement, idx: number) {
  const originalHtml = el.innerHTML;
  const before = originalHtml.slice(0, idx);
  const after = originalHtml.slice(idx);
  // eslint-disable-next-line no-param-reassign -- we need to add this marker to force the position, it is removed.
  el.innerHTML = `${before}<span id="caret-marker"></span>${after}`;
  const marker = el.querySelector('#caret-marker');
  if (marker) {
    const range = document.createRange();
    range.setStartAfter(marker);
    range.collapse(true);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    marker.parentNode?.removeChild(marker);
  }
  el.focus();
}

/**
 * Insert html at a html index.
 * @param originalHtml - Html to mutate.
 * @param htmlIdx - Html index to inset at. @see {@link getHtmlIndexFromSelection}
 * @param htmlToInsert - Html to inset.
 */
function insertHtmlAtIndex(
  originalHtml: string,
  htmlIdx: number,
  htmlToInsert: string
): { newHtml: string; newIndex: number } {
  const before = originalHtml.slice(0, htmlIdx);
  const after = originalHtml.slice(htmlIdx);
  const newHtml = before + htmlToInsert + after;
  const newIndex = htmlIdx + htmlToInsert.length;
  return { newHtml, newIndex };
}

/**
 * Normalize an HTML string by converting all non-breaking spaces to regular spaces
 * and standardizing self-closing `<br />` tags to `<br>`.
 *
 * Does the following replacing:
 *   - All `&nbsp;`, `\u202F`, and `\u00A0` characters are replaced with `' '`.
 *   - All `<br />` tags are replaced with `<br>`.
 *
 * @param str - The HTML string to normalize.
 */
function normalizeHtml(str?: string): string {
  return str?.replace(/&nbsp;|\u202F|\u00A0/g, ' ').replace(/<br \/>/g, '<br>') ?? '';
}

// TODO: see is this can be replaced by `setCaretAtHtmlIndex`
function replaceCaret(el: HTMLElement) {
  const target = document.createTextNode('');
  el.appendChild(target);
  const isFocused = document.activeElement === el;
  if (isFocused && target.nodeValue != null) {
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.setStart(target, target.nodeValue.length);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    el.focus();
  }
}

export type ContentEditableEvent = React.SyntheticEvent<HTMLDivElement> & {
  target: { value: string };
};

export interface CompositionInputRef {
  /** Focus the input */
  focus: () => void;
  getCaretCoordinates: () => { left: number; top: number } | null;
  /**
   * Get the basic visible text.
   *
   * Raw data is available with {@link getRawValue}
   *
   * @example Handling rich content
   * // Input's rich HTML Content: "Hi <span ...>@Alice</span> how are you?"
   * const visible = input.getVisibleText() // Hi @Alice how are you?
   */
  getVisibleText: () => string;
  /**
   * Get the raw html data of the input.
   * @param mutator - An optional mutator function which mutates a clone of the input node before returning the content.
   */
  getRawValue: (mutator?: (nodeClone: HTMLElement) => void) => string;
  getCaretIndex: () => number;
  setCaretIndex: (htmlIndex: number) => void;
  typeAtCaret: (content: string) => void;
}

// TODO: cleanup these types
type Modify<T, R> = Omit<T, keyof R> & R;
type DivProps = Modify<
  JSX.IntrinsicElements['div'],
  { onChange?: (e: ContentEditableEvent) => void }
>;

export interface Props extends DivProps {
  html: string;
  onChange?: (e: ContentEditableEvent) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  innerRef?: React.Ref<HTMLDivElement>;
}

const UnstyledCompositionInput = forwardRef<CompositionInputRef, Props>((props, ref) => {
  const {
    html,
    onChange,
    disabled = false,
    innerRef,
    className,
    style,
    onKeyUp,
    onKeyDown,
    children,
    ...rest
  } = props;

  const elRef = useRef<HTMLDivElement | null>(null);
  const lastHtml = useRef(html);
  const isMount = useRef(true);
  const lastPosition = useRef<number | null>(null);
  const lastHtmlIndex = useRef<number>(0);
  useImperativeHandle(
    ref,
    () => ({
      focus: () => elRef.current?.focus(),

      getVisibleText: () => elRef.current?.innerText ?? '',

      getRawValue: mutator => {
        const el = elRef.current;
        if (!el) {
          return '';
        }

        const clone = el.cloneNode(true) as HTMLElement;
        mutator?.(clone);
        return clone.innerText;
      },

      getCaretCoordinates: () => {
        const el = elRef.current;
        const sel = window.getSelection();
        if (!el || !sel || !sel.rangeCount || !el.contains(sel.anchorNode)) {
          return null;
        }

        const range = sel.getRangeAt(0).cloneRange();
        range.collapse(true);
        let rect = range.getClientRects()[0];
        let marker: Text | null = null;
        if (!rect) {
          marker = document.createTextNode('\u200b');
          range.insertNode(marker);
          range.selectNode(marker);
          rect = range.getClientRects()[0]!;
          if (marker.parentNode) {
            marker.parentNode.removeChild(marker);
          }
        }

        return { left: rect.left + window.pageXOffset, top: rect.bottom + window.pageYOffset };
      },

      getCaretIndex: () => {
        const el = elRef.current;
        if (!el || document.activeElement !== el) {
          return lastHtmlIndex.current;
        }

        const idx = getHtmlIndexFromSelection(el);
        lastHtmlIndex.current = idx;
        return idx;
      },

      setCaretIndex: index => {
        const el = elRef.current;
        if (!el) {
          return;
        }

        setCaretAtHtmlIndex(el, index);
        lastHtmlIndex.current = index;
        lastPosition.current = null;
      },

      typeAtCaret: content => {
        const el = elRef.current;
        if (!el) {
          return;
        }

        const htmlIndex = lastHtmlIndex.current;
        const { newHtml, newIndex } = insertHtmlAtIndex(el.innerHTML, htmlIndex, content);
        el.innerHTML = newHtml;
        lastHtml.current = newHtml;
        lastHtmlIndex.current = newIndex;
        setCaretAtHtmlIndex(el, newIndex);

        if (onChange) {
          onChange({ target: { value: newHtml } } as any);
        }
      },
    }),
    [onChange]
  );

  // Track selection changes when focused
  useEffect(() => {
    const handler = () => {
      const el = elRef.current;
      if (!el || document.activeElement !== el) {
        return;
      }

      lastPosition.current = getHtmlIndexFromSelection(el);
      lastHtmlIndex.current = lastPosition.current;
    };

    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  // Handle innerRef prop
  useLayoutEffect(() => {
    if (!innerRef) {
      return;
    }

    if (typeof innerRef === 'function') {
      innerRef(elRef.current);
    } else {
      (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = elRef.current;
    }
  }, [innerRef]);

  const emitChange = useCallback(
    (e: Omit<ContentEditableEvent, 'target'>) => {
      const el = elRef.current;
      if (!el || !onChange) {
        return;
      }

      const currentHtml = el.innerHTML;

      /**
       * After first edit the input html will minimally contain only a br tag, so even if the user deletes
       * everything the html will just be a single br tag. If the value is just one br tag we want to remove
       * it so the input is empty and the placeholder appears.
       */
      const cleanHtml = currentHtml === '<br>' ? '' : currentHtml;

      if (cleanHtml !== lastHtml.current) {
        // TODO: clean up this type assertion
        onChange({ ...e, target: { value: cleanHtml } } as ContentEditableEvent);
        lastHtml.current = cleanHtml;
      }
    },
    [onChange]
  );

  // Update DOM on html change
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) {
      return;
    }

    if (isMount.current) {
      el.innerHTML = html;
      lastHtml.current = html;
      isMount.current = false;
    } else if (normalizeHtml(html) !== normalizeHtml(el.innerHTML)) {
      el.innerHTML = html;
      lastHtml.current = html;
      replaceCaret(el);
    }
  }, [html]);

  return (
    <div
      {...rest}
      ref={elRef}
      // We don't want rich html editing
      contentEditable={disabled ? false : 'plaintext-only'}
      aria-disabled={disabled}
      suppressContentEditableWarning
      className={className}
      style={style}
      onInput={emitChange}
      onKeyUp={onKeyUp || emitChange}
      onKeyDown={onKeyDown || emitChange}
    >
      {children}
    </div>
  );
});

const CompositionInput = styled(UnstyledCompositionInput)<{
  placeholder?: string;
  scrollbarPadding?: number;
}>`
  height: 100%;
  width: 100%;
  flex-grow: 1;
  color: var(--text-primary-color);
  font-family: var(--font-default);
  line-height: var(--font-size-h2);
  letter-spacing: inherit;
  font-size: inherit;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  text-align: start;
  max-height: 50vh;
  min-height: 28px;
  padding-top: 0;
  padding-inline-end: ${props => props.scrollbarPadding ?? 0}px;
  padding-inline-start: 0.375em;
  padding-bottom: 0.25em;
  overflow-y: auto;
  scrollbar-gutter: stable;
  outline: none;
  border: none;

  &:empty:before {
    content: attr(placeholder);
    display: block;
    color: #aaa;
    font-size: inherit;
  }
`;

export default CompositionInput;
