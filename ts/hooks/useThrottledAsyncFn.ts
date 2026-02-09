/* eslint-disable more/no-then */
import { DependencyList, useEffect, useRef, useState } from 'react';
import useUnmount from 'react-use/lib/useUnmount';

/**
 * Like `useThrottleFn` from react-use, but the callback can be async.
 * The resolved value is stored in state and returned (initially `null`).
 */
export function useThrottledAsyncFn<T>(
  fn: (...args: Array<unknown>) => Promise<T>,
  ms: number,
  deps: DependencyList
): T | null {
  const [state, setState] = useState<T | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nextDeps = useRef<DependencyList>(undefined);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!timeout.current) {
      // First call – invoke immediately
      void fnRef.current(...deps).then(setState);

      const timeoutCallback = () => {
        if (nextDeps.current) {
          const captured = nextDeps.current;
          nextDeps.current = undefined;
          void fnRef.current(...captured).then(setState);
          timeout.current = setTimeout(timeoutCallback, ms);
        } else {
          timeout.current = undefined;
        }
      };

      timeout.current = setTimeout(timeoutCallback, ms);
    } else {
      nextDeps.current = deps;
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps -- needed to avoid render loops

  useUnmount(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
  });

  return state;
}
