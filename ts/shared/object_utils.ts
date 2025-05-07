/**
 * Object.entries() but in a type-safe way.
 * @param obj The object to get the entries from.
 */
export const objectEntries = <T extends { [K in keyof T]: T[K] }>(obj: T) => {
  return Object.entries(obj) as Array<{ [K in keyof T]: [K, T[K]] }[keyof T]>;
};
