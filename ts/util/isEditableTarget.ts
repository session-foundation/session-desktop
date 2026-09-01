export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const editableSelector =
    'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]';
  return !!target.closest(editableSelector);
}
