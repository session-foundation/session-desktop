export function isStringArray(value: unknown): value is Array<string> {
  return Array.isArray(value) && value.every(val => typeof val === 'string');
}
