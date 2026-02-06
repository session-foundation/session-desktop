// NOTE: this file has functions that use selectors from multiple slices, keeping it
// separate prevents circular dependencies

import { ModalId } from './ducks/modalDialog';
import { useFocusedMessageId, useIsCompositionTextAreaFocused } from './selectors/conversations';
import { useModalStack } from './selectors/modal';

export type FocusScope =
  | 'global'
  | 'conversationList'
  | 'message'
  | 'compositionBoxInput'
  | ModalId;

export type ScopeWithId = 'message';
export type ScopeWithoutId = Exclude<FocusScope, ScopeWithId>;

type ScopeArgs =
  | { scope: ScopeWithoutId; scopeId?: never }
  | { scope: ScopeWithId; scopeId: string | 'all' };

export function useFocusScope() {
  const modalStack = useModalStack();
  const focusedMessageId = useFocusedMessageId();
  const isCompositionTextAreaFocused = useIsCompositionTextAreaFocused();

  return {
    isCompositionTextAreaFocused,
    focusedMessageId,
    modalId: modalStack?.length ? modalStack[modalStack.length - 1] : null,
  };
}

export function useIsInScope({ scope, scopeId }: ScopeArgs) {
  const { modalId, focusedMessageId, isCompositionTextAreaFocused } = useFocusScope();

  if (scope === 'global') {
    return true;
  }

  if (scope === 'message') {
    if (scopeId === 'all') {
      return !!focusedMessageId;
    }
    return scopeId && scopeId === focusedMessageId;
  }

  if (scope === 'conversationList') {
    return !modalId && !focusedMessageId && !isCompositionTextAreaFocused;
  }

  if (scope === 'compositionBoxInput') {
    return isCompositionTextAreaFocused;
  }

  return modalId === scope;
}
