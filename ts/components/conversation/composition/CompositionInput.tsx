import React, {
  useRef,
  useLayoutEffect,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
  type HTMLAttributes,
  type ClipboardEvent,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react';
import styled from 'styled-components';
import { isUndefined } from 'lodash';
import { useDebouncedSpellcheck } from '../../../hooks/useDebuncedSpellcheck';
import { useDebouncedSelectAllOnTripleClickHandler } from '../../../hooks/useDebouncedSelectAllOnTripleClickHandler';
import { useHistory } from '../../../hooks/useHistory';

enum DATA_ATTRIBUTE {
  NODE = 'data-con-node',
  CHARS = 'data-con-chars',
}

export enum DATA_CON_NODE {
  ZERO = 'zero',
}

type ConvoSpanProps = HTMLAttributes<HTMLSpanElement> & {
  [DATA_ATTRIBUTE.NODE]: DATA_CON_NODE;
  [DATA_ATTRIBUTE.CHARS]: number;
};

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
 * @param htmlIdx - Html index to insert at. @see {@link getHtmlIndexFromSelection}
 * @param htmlToInsert - Html to insert.
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
 * Remove html at a html index.
 * @param originalHtml - Html to mutate
 * @param htmlIdx - Html index to insert at. @see {@link getHtmlIndexFromSelection}
 * @param numberOfCharactersToRemove - Number of characters to remove before the index.
 */
function removeHtmlBeforeIndex(
  originalHtml: string,
  htmlIdx: number,
  numberOfCharactersToRemove: number
): { newHtml: string; newIndex: number } {
  // TODO: handle when htmlIdx - toRemove < 0
  const before = originalHtml.slice(0, htmlIdx - numberOfCharactersToRemove);
  const after = originalHtml.slice(htmlIdx);
  const newHtml = before + after;
  const newIndex = htmlIdx - numberOfCharactersToRemove;
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
  return str?.replace(/&nbsp;|\u202F|\u00A0/g, ' ')?.replace(/<br>|<br\/>|<br \/>/g, '') ?? '';
}

/**
 * Append an empty text node to an element, if the element is focused the caret will go to the end
 * and the element will be refocused in the new text node.
 * @param el - Element to replace the caret in
 */
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

function ConSpan(props: ConvoSpanProps) {
  return <span {...props} />;
}

export function ZeroWidthNode() {
  return (
    <ConSpan data-con-node={DATA_CON_NODE.ZERO} data-con-chars={0} contentEditable={false}>
      {'﻿'}
    </ConSpan>
  );
}

function isElementNode(el: Node): el is Element {
  return el.nodeType === Node.ELEMENT_NODE;
}

function isCaratElement(el: Node) {
  return el.nodeType === Node.TEXT_NODE && !el.nodeValue;
}

function isNoneElement(el?: Node | null) {
  return !el || isCaratElement(el);
}

function isZeroWidthNode(el: Node | null) {
  return el && isElementNode(el) && 'getAttribute' in el && typeof el.getAttribute === 'function'
    ? el.getAttribute(DATA_ATTRIBUTE.NODE) === DATA_CON_NODE.ZERO
    : false;
}

export function createInputNode(
  type: DATA_CON_NODE,
  chars: number | undefined,
  childNode: ChildNode | null
) {
  const node = document.createElement('span');

  node.setAttribute('contenteditable', 'false');
  node.setAttribute(DATA_ATTRIBUTE.NODE, type);

  if (chars !== null) {
    node.setAttribute(DATA_ATTRIBUTE.CHARS, `${chars}`);
  }

  if (childNode !== null) {
    node.appendChild(childNode);
  }

  return node;
}

function markNodeForDeletion(queue: Array<Node>, reason: string, ...nodes: Array<Node>) {
  queue.push(...nodes);
  window.log.debug('COMP-DELETE', reason, nodes);
}

type ContentEditableEventWithoutTarget = Omit<React.SyntheticEvent<HTMLDivElement>, 'target'>;
export type ContentEditableEvent = ContentEditableEventWithoutTarget & {
  target: { value: string; caratHtmlIndex: number | null };
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
  typeAtCaret: (content: string, previousCharactersToRemove?: number) => void;
  resetState: (content: string) => void;
}

export type ContentEditableProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> &
  React.RefAttributes<HTMLDivElement> & {
    /** The current HTML content. */
    html: string;
    /** Called when the content changes. */
    onChange?: (e: ContentEditableEvent) => void;
    /** If true, disables editing (e.g., remove contentEditable or make read-only). */
    disabled?: boolean;
    innerRef?: React.Ref<HTMLDivElement>;
  };

const UnstyledCompositionInput = forwardRef<CompositionInputRef, ContentEditableProps>(
  (props, ref) => {
    const {
      html,
      onChange,
      disabled = false,
      innerRef,
      className,
      style,
      onKeyUp,
      onKeyDown,
      onClick,
      children,
      ...rest
    } = props;

    const elRef = useRef<HTMLDivElement | null>(null);
    const lastHtml = useRef(html);
    const isMount = useRef(true);
    const lastPosition = useRef<number | null>(null);
    const lastHtmlIndex = useRef<number>(0);

    useDebouncedSpellcheck({
      elementRef: elRef,
    });

    const { undo, redo, commit, reset } = useHistory<string>(html);

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

        typeAtCaret: (content, previousCharactersToRemove = 0) => {
          const el = elRef.current;
          if (!el) {
            return;
          }

          let htmlIndex = lastHtmlIndex.current;
          let htmlToEdit = el.innerHTML;
          if (previousCharactersToRemove) {
            const res = removeHtmlBeforeIndex(htmlToEdit, htmlIndex, previousCharactersToRemove);
            htmlToEdit = res.newHtml;
            htmlIndex = res.newIndex;
          }

          const { newHtml, newIndex } = insertHtmlAtIndex(htmlToEdit, htmlIndex, content);
          el.innerHTML = newHtml;
          lastHtml.current = newHtml;
          lastHtmlIndex.current = newIndex;
          setCaretAtHtmlIndex(el, newIndex);

          if (onChange) {
            onChange({ target: { value: newHtml } } as any);
          }
        },

        /**
         * Exposed to allow for manual resetting, Should only be used if required. (Eg: if in a class component)
         */
        resetState: (content: string) => {
          reset(content);
        },
      }),
      [onChange, reset]
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

    const handleChange = useCallback(() => {
      const el = elRef.current;
      if (!el) {
        return false;
      }

      const readerChildren = el.childNodes;
      // TODO: see if we can replace this with in-line .remove() calls.
      const nodesToDelete: Array<ChildNode> = [];

      for (let i = 0; i < readerChildren.length; i++) {
        const node = readerChildren[i];

        if (isNoneElement(node)) {
          continue;
        }

        if (isElementNode(node) && node?.tagName === 'BR') {
          markNodeForDeletion(nodesToDelete, 'BR tag is forbidden', node);
          continue;
        }

        if (!isZeroWidthNode(node)) {
          continue;
        }

        const next = node.nextSibling;
        const prev = node.previousSibling;

        /**
         * TODO: check this for accuracy, the in-line comments are more accurate and updated
         * Note: "none" here means null or carat.
         *
         * If n is ZN:
         *  - If n - 1 is none: // means it's at the start of the DOM
         *    - If n + 1 is a ZN:
         *      - If n + 2 is an Element:
         *        Mark n and n + 1 for deletion.
         *    - Else:
         *        Mark n for deletion. (log a warning)
         *
         *  - If n + 1 is none: // means it's at the end of the DOM (can also be at the start)
         *    - If n - 1 is an Element and not ZN:
         *    Mark n and n - 1 for deletion
         *  - Else If n + 1 is ZN:
         *    - If n + 2 is not none:
         *      Mark n and n + 1 for deletion.
         *
         *  - If n + 1 and n - 1 are not a ZN:
         *    Mark n for deletion // log warning
         */

        // If n - 1 is none - this should mean it's at the start
        if (isNoneElement(prev)) {
          // NOTE: n is the first element
          // If n + 1 is a ZN
          if (next && isZeroWidthNode(next)) {
            const nextNextNode = next.nextSibling;
            // If n + 2 is none or not an Element
            // TODO: if nextNextNode is none we know the dom is empty and can be erased (exit early)
            if (isNoneElement(nextNextNode) || (nextNextNode && !isElementNode(nextNextNode))) {
              // NOTE: n and n + 1 are at the start and don't have an element next
              // Mark n and n + 1 for deletion
              markNodeForDeletion(nodesToDelete, 'Dom is empty, erase ZN', node, next);
            }
            // orphan ZN pair (no ZN sibling, delete it)
          } else {
            // Mark n for deletion. (log a warning)
            const msg = 'Start node is Zero width with no next sibling';
            markNodeForDeletion(nodesToDelete, msg, node);
            window.log.warn(msg);
          }
          // If n + 1 is none (to get here n - 1 has to exist and be anything, so this pair is not at the start)
        } else if (isNoneElement(next)) {
          // If n - 1 is an Element and not ZN
          if (prev && isElementNode(prev) && !isZeroWidthNode(prev)) {
            // NOTE: this means the ZN forward sibling has been deleted, so we need to delete this node and the element it is attached to
            // Mark n and n - 1 for deletion
            markNodeForDeletion(nodesToDelete, 'ZN forward sibling deleted', node, prev);

            // NOTE: there is an edge case where the n - 2 and n - 3 are also ZN and n - 3 is the first node, we need to delete these too in this case.
            // This is possible if the only things in the dom are [ZN, ZN, E, ZN, ZN]
            const prevPrev = prev.previousSibling;
            const prevPrevPrev = prevPrev?.previousSibling ?? null;
            const prevPrevPrevPrev = prevPrevPrev?.previousSibling ?? null;
            if (
              prevPrev &&
              isZeroWidthNode(prevPrev) &&
              prevPrevPrev &&
              isZeroWidthNode(prevPrevPrev) &&
              isNoneElement(prevPrevPrevPrev)
            ) {
              markNodeForDeletion(
                nodesToDelete,
                'ZN forward sibling deleted (Leading ZN edge case)',
                prevPrev,
                prevPrevPrev
              );
            }
          }
          // If n + 1 is ZN
        } else if (next && isZeroWidthNode(next)) {
          const nextNextNode = next.nextSibling;
          // If n + 2 is none
          if (isNoneElement(nextNextNode)) {
            // Mark n and n + 1 for deletion
            // TODO: commented out because i think this is a bug, check
            // nodesToDelete.push(node, next);
          }
        }

        // If n + 1 and n - 1 are not ZN
        if ((!prev || !isZeroWidthNode(prev)) && (!next || !isZeroWidthNode(next))) {
          const msg = 'Zero width node marked for deletion with no siblings!';
          markNodeForDeletion(nodesToDelete, msg, node);
          window.log.warn(msg);
        }
      }

      for (let i = 0; i < nodesToDelete.length; i++) {
        const node = nodesToDelete[i];
        if (node) {
          node.remove();
        }
      }

      const lastChild = el.lastChild;

      /**
       * If the last node is an element. Because the carat counts as a valueless Node.TEXT_NODE, it
       * is also possible for the last element (in this check) to be the carat.
       * If the last node is not an element we need to check if the last element looks like the carat
       * and that its previous sibling is an element.
       */
      const appendZeroWidth =
        lastChild &&
        ((isElementNode(lastChild) && !isZeroWidthNode(lastChild) && !isCaratElement(lastChild)) ||
          (isCaratElement(lastChild) &&
            lastChild.previousSibling &&
            isElementNode(lastChild.previousSibling) &&
            !isZeroWidthNode(lastChild)));

      if (appendZeroWidth) {
        const textNode = document.createTextNode('﻿');
        const node = createInputNode(DATA_CON_NODE.ZERO, 0, textNode);
        el.appendChild(node);
        el.appendChild(node.cloneNode(true));
      }

      /**
       * If the first node is an element we need to prepend a zero width element.
       */
      const firstChild = el.firstChild;

      const prependZeroWidth =
        firstChild &&
        isElementNode(firstChild) &&
        !isNoneElement(firstChild) &&
        !isZeroWidthNode(firstChild);

      if (prependZeroWidth) {
        const textNode = document.createTextNode('﻿');
        const node = createInputNode(DATA_CON_NODE.ZERO, 0, textNode);
        const nodeClone = node.cloneNode(true);
        el.prepend(node, nodeClone);
      }

      const renderedHtml = el.innerHTML;

      let idx = getHtmlIndexFromSelection(el);

      if (idx > renderedHtml.length) {
        window.log.warn(
          'Input index is greater than the length! Setting the index to the end of the input'
        );
        idx = renderedHtml.length;
      }

      if (renderedHtml !== lastHtml.current) {
        lastHtml.current = renderedHtml;
        lastHtmlIndex.current = idx;
        setCaretAtHtmlIndex(el, idx);

        window.log.debug('COMP', renderedHtml);

        return true;
      }
      return false;
    }, []);

    const emitChangeEvent = useCallback(
      (e: ContentEditableEventWithoutTarget, preventUndoStackCommit = false) => {
        const el = elRef.current;
        if (!el || !onChange) {
          return;
        }

        const caratHtmlIndex = lastHtmlIndex.current;
        const value = lastHtml.current;
        // TODO: clean up this type assertion
        onChange({ ...e, target: { value, caratHtmlIndex } } as ContentEditableEvent);
        if (!preventUndoStackCommit) {
          commit(value);
        }
      },
      [onChange, commit]
    );

    const onInput = useCallback(
      (e: Omit<ContentEditableEvent, 'target'>) => {
        const hasChanged = handleChange();
        if (hasChanged) {
          emitChangeEvent(e);
        }
      },
      [emitChangeEvent, handleChange]
    );

    const onCopy = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const selection = window.getSelection();
      const cleanedContent = selection?.toString().replaceAll('﻿', '');
      if (cleanedContent) {
        e.clipboardData.setData('text/plain', cleanedContent);
      }
    }, []);

    const _onClick = useDebouncedSelectAllOnTripleClickHandler({
      elementRef: elRef,
      onClick,
    });

    const handleUndo = useCallback(
      (e: ContentEditableEventWithoutTarget) => {
        let item = undo();
        if (!isUndefined(item)) {
          if (item === lastHtml.current) {
            item = undo();
          }
          if (!isUndefined(item)) {
            lastHtml.current = item;
            emitChangeEvent(e, true);
          }
        }
      },
      [emitChangeEvent, undo]
    );

    const handleRedo = useCallback(
      (e: ContentEditableEventWithoutTarget) => {
        const item = redo();
        if (item) {
          lastHtml.current = item;
          emitChangeEvent(e, true);
        }
      },
      [emitChangeEvent, redo]
    );

    const _onKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey || e.metaKey) {
          if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
            // Ctrl+Y or Cmd+Y
            // Ctrl+Shift+Z or Cmd+Shift+Z
            e.preventDefault();
            handleRedo(e);
          } else if (e.key === 'z' && !e.shiftKey) {
            // Ctrl+Z or Cmd+Z (without Shift)
            e.preventDefault();
            handleUndo(e);
          }
        }
        onKeyDown?.(e);
      },
      [onKeyDown, handleRedo, handleUndo]
    );

    const createSyntheticEvent = useCallback(
      ({
        event,
        preventDefault,
        stopPropagation,
      }: {
        event: InputEvent;
        preventDefault?: boolean;
        stopPropagation?: boolean;
      }) => {
        const el = elRef.current;
        if (!el) {
          return null;
        }

        if (preventDefault) {
          event.preventDefault();
        }

        if (stopPropagation) {
          event.stopPropagation();
        }

        return {
          ...event,
          currentTarget: el,
          target: el,
          isDefaultPrevented: () => preventDefault || false,
          isPropagationStopped: () => stopPropagation || false,
          persist: () => false,
          nativeEvent: {} as Event,
        } satisfies SyntheticEvent<HTMLDivElement>;
      },
      []
    );

    const handleBeforeInput = useCallback(
      (e: InputEvent) => {
        if (e.inputType === 'historyUndo') {
          const event = createSyntheticEvent({
            event: e,
            preventDefault: true,
          });
          if (event) {
            handleUndo(event);
          }
        } else if (e.inputType === 'historyRedo') {
          const event = createSyntheticEvent({
            event: e,
            preventDefault: true,
          });
          if (event) {
            handleRedo(event);
          }
        }
      },
      [handleUndo, createSyntheticEvent, handleRedo]
    );

    useEffect(() => {
      const el = elRef.current;
      if (!el) {
        return;
      }
      el.addEventListener('beforeinput', handleBeforeInput);
      // eslint-disable-next-line consistent-return
      return () => el.removeEventListener('beforeinput', handleBeforeInput);
    }, [elRef, handleBeforeInput]);

    // Update DOM on html change
    useLayoutEffect(() => {
      /**
       * After first edit the input html will minimally contain only a br tag, so even if the user deletes
       * everything the html will just be a single br tag. If the value is just one br tag we want to remove
       * it so the input is empty and the placeholder appears.
       */
      const el = elRef.current;
      if (!el) {
        return;
      }

      const normalizedHtml = normalizeHtml(html);
      const normalizedCurrentHtml = normalizeHtml(el.innerHTML);

      if (normalizedHtml.includes('<br>')) {
        window.log.error('There is a BR tag inside the composition input!! This is really bad!');
      }

      if (isMount.current) {
        el.innerHTML = normalizedHtml;
        lastHtml.current = normalizedHtml;
        isMount.current = false;
      } else if (normalizedHtml !== normalizedCurrentHtml) {
        el.innerHTML = normalizedHtml;
        lastHtml.current = normalizedHtml;
        handleChange();
        replaceCaret(el);
      }
    }, [handleChange, html]);

    return (
      <div
        {...rest}
        ref={elRef}
        // We don't want rich html editing
        contentEditable={disabled ? false : 'plaintext-only'}
        role="textbox"
        spellCheck={true}
        aria-disabled={disabled}
        aria-multiline={true}
        suppressContentEditableWarning
        className={className}
        style={style}
        onInput={onInput}
        onKeyUp={onKeyUp}
        onKeyDown={_onKeyDown}
        onCopy={onCopy}
        onClick={_onClick}
      >
        {children}
      </div>
    );
  }
);

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
  text-rendering: optimizeLegibility;

  user-select: text;
  * {
    user-select: text;
  }

  &:empty:before {
    content: attr(placeholder);
    display: block;
    color: #aaa;
    font-size: inherit;
  }
`;

export default CompositionInput;
