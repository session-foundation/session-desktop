import { type RefObject, useCallback, useEffect } from 'react';
import { debounce } from 'lodash';

interface DebouncedSpellcheckProps {
  elementRef: RefObject<HTMLDivElement | HTMLInputElement | HTMLTextAreaElement>;
  delay?: number;
}

export const useDebouncedSpellcheck = ({ delay = 300, elementRef }: DebouncedSpellcheckProps) => {
  const enableSpellcheck = useCallback(() => {
    elementRef.current?.setAttribute('spellcheck', 'true');
  }, [elementRef]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: see if we can create our own useDebounce hook
  const debouncedSpellcheck = useCallback(debounce(enableSpellcheck, delay), [
    enableSpellcheck,
    delay,
  ]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) {
      return;
    }

    const handleInput = () => {
      el.setAttribute('spellcheck', 'false');
      debouncedSpellcheck();
    };

    el.addEventListener('input', handleInput);

    // eslint-disable-next-line consistent-return -- This return is the destructor
    return () => {
      el.removeEventListener('input', handleInput);
    };
  }, [debouncedSpellcheck, elementRef]);
};
