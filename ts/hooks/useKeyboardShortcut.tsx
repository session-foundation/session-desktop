import useKey, { Handler } from 'react-use/lib/useKey';
import { useIsInScope } from '../state/selectors/modal';
import { ctrlKey, KbdShortcutOptions } from '../util/keyboardShortcuts';

export function useKeyboardShortcut(
  shortcut: KbdShortcutOptions,
  handler: Handler | undefined | null,
  disabled?: boolean | (() => boolean)
) {
  const inScope = useIsInScope(shortcut.scope);

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
      (shortcut.withAlt && !e.altKey) ||
      (shortcut.withShift && !e.shiftKey) ||
      (shortcut.withCtrl && !e[ctrlKey])
    ) {
      return false;
    }

    if (shortcut.keys[0] === e.key) {
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
