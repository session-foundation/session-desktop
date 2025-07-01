import { useEffect, useState } from 'react';

/**
 * A custom hook that polls an async function at a specified interval.
 * @param fn The async function to be called.
 * @param pollInterval The interval in milliseconds at which to call the function.
 * @param identifier A string identifier for the polling operation, used for logging.
 * @returns An object containing the result of the function call and any error that occurred.
 */
export function usePolling<T>(fn: () => Promise<T>, pollInterval: number, identifier: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const execute = async () => {
      if (!isMounted) {
        return;
      }

      try {
        const result = await fn();
        if (isMounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        window.log.warn(`${identifier} polling error:`, err);
        if (isMounted) {
          setError(err as Error);
        }
      }
    };

    const voidedExecute = () => {
      void execute();
    };

    voidedExecute();

    const interval = setInterval(voidedExecute, pollInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fn, pollInterval, identifier]);

  return { data, error };
}
