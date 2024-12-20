import { NonEmptyArray } from '../../types/utility';

export type BatchResultEntry = {
  code: number;
  body: Record<string, any>;
};

export type NotEmptyArrayOfBatchResults = NonEmptyArray<BatchResultEntry>;
