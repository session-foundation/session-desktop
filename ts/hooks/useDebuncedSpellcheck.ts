import { type RefObject, useCallback, useEffect } from 'react';
import { debounce } from 'lodash';

interface DebouncedSpellcheckProps {
  elementRef: RefObject<HTMLDivElement | HTMLInputElement | HTMLTextAreaElement>;
  delay?: number;
  disabled?: boolean;
}

export const useDebouncedSpellcheck = ({
  delay = 300,
  elementRef,
  disabled,
}: DebouncedSpellcheckProps) => {
  const enableSpellcheck = useCallback(() => {
    const el = elementRef.current;
    if (!el || disabled) {
      return;
    }
    el.setAttribute('spellcheck', 'true');
  }, [elementRef, disabled]);

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

    // Set initial spellcheck state based on disabled prop
    if (disabled) {
      el.setAttribute('spellcheck', 'false');
      return;
    }

    const handleInput = () => {
      if (disabled) {
        return;
      }

      el.setAttribute('spellcheck', 'false');
      debouncedSpellcheck();
    };

    el.addEventListener('input', handleInput);

    // eslint-disable-next-line consistent-return -- This return is the destructor
    return () => {
      el.removeEventListener('input', handleInput);
      debouncedSpellcheck.cancel();
    };
  }, [debouncedSpellcheck, elementRef, disabled]);

  // Additional effect to handle disabled prop changes
  useEffect(() => {
    const el = elementRef.current;
    if (!el) {
      return;
    }

    if (disabled) {
      // Cancel any pending spellcheck enabling and set to false
      debouncedSpellcheck.cancel();
      el.setAttribute('spellcheck', 'false');
    }
  }, [disabled, debouncedSpellcheck, elementRef]);
};
