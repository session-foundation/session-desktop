export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const editableSelector =
    'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]';
  return !!target.closest(editableSelector);
}

/**
 * Like `isEditableTarget(event.target)`, but sees through shadow roots: a listener outside a
 * shadow root (e.g. the emoji-mart search box) only gets the shadow host as `event.target`.
 */
export function isEditableEventTarget(event: Event) {
  return isEditableTarget(event.composedPath()[0] ?? event.target);
}
