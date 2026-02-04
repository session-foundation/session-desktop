import useKey, { Handler } from 'react-use/lib/useKey';
import { ScopeWithId, ScopeWithoutId, useIsInScope } from '../state/selectors/modal';
import { ctrlKey, KbdShortcutOptions } from '../util/keyboardShortcuts';

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
