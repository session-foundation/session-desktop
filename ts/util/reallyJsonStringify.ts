function strOrToString(value: unknown): string {
  return typeof value === 'string' ? value : Object.prototype.toString.call(value);
}

/**
 * Returns `JSON.stringify(value)` if that returns a string, otherwise returns a value
 * like `[object Object]` or `[object Undefined]`.
 * Always returns a string, and does not throw.
 */
export function reallyJsonStringify(value: unknown): string {
  try {
    return strOrToString(JSON.stringify(value));
  } catch (_err) {
    return strOrToString(undefined);
  }
}
