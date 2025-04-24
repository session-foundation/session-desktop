import { useEffect, useState } from 'react';

export function usePolling<T>(fn: () => Promise<T>, delay: number) {
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
        window.log.warn('Polling error:', err);
        if (isMounted) {
          setError(err as Error);
        }
      }
    };

    const voidedExecute = () => {
      void execute();
    };

    voidedExecute();

    const interval = setInterval(voidedExecute, delay);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fn, delay]);

  return { data, error };
}
