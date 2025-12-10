import type { JSX } from 'react';

export type RenderTextCallbackType = (options: {
  text: string;
  key: number;
  isGroup: boolean;
  isPublic: boolean;
}) => JSX.Element;

export type DeepNullable<T> = {
  [P in keyof T]: T[P] extends object ? DeepNullable<T[P]> : T[P] | null;
};

// eslint-disable-next-line @typescript-eslint/array-type
export type NonEmptyArray<T> = [T, ...T[]];
