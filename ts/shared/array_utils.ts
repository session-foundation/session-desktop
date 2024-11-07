export function hasDuplicates<T>(array: Array<T>): boolean {
  return new Set(array).size < array.length;
}
