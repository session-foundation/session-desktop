import type { NonEmptyArray } from '../../../types/Util';

export type BatchResultEntry = {
  code: number;
  body: Record<string, any>;
};

export type NotEmptyArrayOfBatchResults = NonEmptyArray<BatchResultEntry>;
