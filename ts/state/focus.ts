// NOTE: this file has functions that use selectors from multiple slices, keeping it
// separate prevents circular dependencies

import { useIsRightPanelShowing } from '../hooks/useUI';
import { ModalId } from './ducks/modalDialog';
import { useFocusedMessageId, useIsCompositionTextAreaFocused } from './selectors/conversations';
import { useTopModalId } from './selectors/modal';

export type FocusScope =
  | 'global'
  | 'conversationList'
  | 'message'
  | 'compositionBoxInput'
  | 'rightPanel'
  | ModalId;

export type ScopeWithId = 'message';
export type ScopeWithoutId = Exclude<FocusScope, ScopeWithId>;

type ScopeArgs =
  | { scope: ScopeWithoutId; scopeId?: never }
  | { scope: ScopeWithId; scopeId: string | 'all' };

export function useFocusScope() {
  const topModalId = useTopModalId();
  const focusedMessageId = useFocusedMessageId();
  const isCompositionTextAreaFocused = useIsCompositionTextAreaFocused();
  const isRightPanelShowing = useIsRightPanelShowing();

  return {
    isCompositionTextAreaFocused,
    focusedMessageId,
    isRightPanelShowing,
    modalId: topModalId,
  };
}

export function useIsInScope({ scope, scopeId }: ScopeArgs) {
  const { modalId, focusedMessageId, isCompositionTextAreaFocused, isRightPanelShowing } =
    useFocusScope();

  if (scope === 'global') {
    return true;
  }

  // if we've got a modal shown, and it is the one the scope is far, return `true`
  if (modalId && modalId === scope) {
    return true;
  }

  // If there is a modal shown and the scope is not the modal, return `false`.
  // It is important to have this call early as the scopes below expect modalId to be falsy in their conditions.
  if (modalId) {
    return false;
  }

  if (scope === 'rightPanel') {
    // The right panel shortcuts should only react when it is showing
    // and the previous conditions didn't return earlier
    return isRightPanelShowing;
  }

  // the conversation list shortcuts should only react when there are no modal visible
  if (scope === 'conversationList') {
    return !focusedMessageId && !isCompositionTextAreaFocused && !isRightPanelShowing;
  }

  if (scope === 'message') {
    if (scopeId === 'all') {
      return !!focusedMessageId;
    }
    return scopeId && scopeId === focusedMessageId;
  }

  if (scope === 'compositionBoxInput') {
    return isCompositionTextAreaFocused;
  }

  return false;
}
