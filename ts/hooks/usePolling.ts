import { useEffect, useState } from 'react';

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
