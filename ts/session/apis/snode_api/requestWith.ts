import { AbortSignal } from 'abort-controller';
// eslint-disable-next-line import/no-unresolved
import { AbortSignal as AbortSignalNode } from 'node-fetch/externals';

export type MergedAbortSignal = AbortSignal | AbortSignalNode;

export type WithTimeoutMs = { timeoutMs: number };
export type WithAbortSignal = { abortSignal: MergedAbortSignal };
