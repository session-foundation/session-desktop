export type RenderTextCallbackType = (options: {
  text: string;
  key: number;
  isGroup: boolean;
  isPublic: boolean;
}) => JSX.Element;

/**
 * Recursively get all keys of an object, including nested objects treating them as strings
 */
export type RecursiveKeys<T> = T extends object
  ? {
      [K in Extract<keyof T, string>]:
        | K
        | (T[K] extends object ? `${K}.${RecursiveKeys<T[K]>}` : never);
    }[Extract<keyof T, string>]
  : never;

export type DeepNullable<T> = {
  [P in keyof T]: T[P] extends object ? DeepNullable<T[P]> : T[P] | null;
};

// eslint-disable-next-line @typescript-eslint/array-type
export type NonEmptyArray<T> = [T, ...T[]];
