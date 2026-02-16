import useKey, { Handler } from 'react-use/lib/useKey';
import { ctrlKey, KbdShortcutOptions } from '../util/keyboardShortcuts';
import { ScopeWithId, ScopeWithoutId, useIsInScope } from '../state/focus';

type BaseShortcutOptions = {
  shortcut: KbdShortcutOptions;
  handler: Handler | undefined | null;
  disabled?: boolean | (() => boolean);
};

type ShortcutOptionsWithoutId = BaseShortcutOptions & {
  shortcut: KbdShortcutOptions & { scope: ScopeWithoutId };
  scopeId?: never;
};

type ShortcutOptionsWithId = BaseShortcutOptions & {
  shortcut: KbdShortcutOptions & { scope: ScopeWithId };
  scopeId: string;
};

type ShortcutOptions = ShortcutOptionsWithoutId | ShortcutOptionsWithId;

export function useKeyboardShortcut({ shortcut, handler, disabled, scopeId }: ShortcutOptions) {
  const inScope = useIsInScope(
    shortcut.scope === 'message'
      ? { scope: shortcut.scope, scopeId: scopeId as string }
      : { scope: shortcut.scope }
  );

  // NOTE: we pass handler in so we can type guard it
  const isDisabled = (_handler: Handler | undefined | null): _handler is undefined | null => {
    return !!(
      !inScope ||
      (typeof disabled === 'function' ? disabled() : disabled) ||
      typeof _handler !== 'function'
    );
  };

  const predicate = (e: KeyboardEvent) => {
    if (isDisabled(handler)) {
      return false;
    }

    if (
      (e.altKey && !shortcut.withAlt) ||
      (e[ctrlKey] && !shortcut.withCtrl) ||
      (e.shiftKey && !shortcut.withShift)
    ) {
      return false;
    }

    if (
      (shortcut.withAlt && !e.altKey) ||
      (shortcut.withShift && !e.shiftKey) ||
      (shortcut.withCtrl && !e[ctrlKey])
    ) {
      return false;
    }

    if (shortcut.keys[0].toLowerCase() === e.key.toLowerCase()) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }

    return false;
  };

  const _handler = (e: KeyboardEvent) => {
    if (isDisabled(handler)) {
      return false;
    }
    return handler(e);
  };

  return useKey(predicate, _handler);
}

/**
 * This is a shortcut to blur the active element and only if nothing is active, call the handler.
 * This can be used to map escape to unfocus a textarea/input, and then close the component containing that item, for instance
 */
export function useEscBlurThenHandler(handler: () => void) {
  useKeyboardShortcut({
    shortcut: { name: 'Blur then handler', scope: 'global', keys: ['Escape'] },
    handler: () => {
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
        active.blur();
        return;
      }
      handler();
    },
  });
}

export function useEscEmptyBlurThenHandler(handler: () => void, clearFn: () => void) {
  useKeyboardShortcut({
    shortcut: { name: 'Empty, blur then handler', scope: 'global', keys: ['Escape'] },
    handler: () => {
      const active = document.activeElement;
      // if there are no active element, just call the handler
      if (!active) {
        handler();
        return;
      }

      // if the active element is not an input/textarea, just call the handler
      if (!(active instanceof HTMLTextAreaElement) && !(active instanceof HTMLInputElement)) {
        handler();
        return;
      }

      // if the active element is an input/textarea, and it is empty, just call the blur() on it.
      // The next time Esc is pressed, the handler will be called
      if (!active.value) {
        active.blur();

        return;
      }

      clearFn();
    },
  });
}
