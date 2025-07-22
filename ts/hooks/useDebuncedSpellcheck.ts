import { type RefObject, useCallback, useEffect } from 'react';
import { debounce } from 'lodash';

interface DebouncedSpellcheckProps {
  elementRef: RefObject<HTMLDivElement | HTMLInputElement | HTMLTextAreaElement>;
  delay?: number;
}

// Global reference counter for the hook
let hookUsageCount = 0;
const STYLE_ID = 'debounced-spellcheck-styles';

const cssStyles = `
  .spellcheck-hidden::-webkit-spelling-error {
    text-decoration: none !important;
  }

  .spellcheck-hidden::-webkit-grammar-error {
    text-decoration: none !important;
  }

  .spellcheck-hidden::-moz-spelling-error {
    text-decoration: none !important;
  }

  .spellcheck-hidden::-moz-grammar-error {
    text-decoration: none !important;
  }

  .spellcheck-hidden::spelling-error {
    text-decoration: none !important;
  }

  .spellcheck-hidden::grammar-error {
    text-decoration: none !important;
  }
`;

export const useDebouncedSpellcheck = ({ delay = 600, elementRef }: DebouncedSpellcheckProps) => {
  // Inject CSS styles if they don't exist
  useEffect(() => {
    hookUsageCount++;

    // Only inject styles on first usage
    if (hookUsageCount === 1 && !document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = cssStyles;
      document.head.appendChild(style);
    }

    // Remove styles only when no components are using the hook
    return () => {
      hookUsageCount--;
      if (hookUsageCount === 0) {
        const existingStyle = document.getElementById(STYLE_ID);
        if (existingStyle) {
          existingStyle.remove();
        }
      }
    };
  }, []);

  const hideSpellcheckLines = useCallback(() => {
    elementRef.current?.classList.add('spellcheck-hidden');
  }, [elementRef]);

  const showSpellcheckLines = useCallback(() => {
    elementRef.current?.classList.remove('spellcheck-hidden');
  }, [elementRef]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: see if we can create our own useDebounce hook
  const debouncedShowSpellcheck = useCallback(debounce(showSpellcheckLines, delay), [
    showSpellcheckLines,
    delay,
  ]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) {
      return;
    }

    const handleInput = () => {
      // Hide spellcheck lines immediately while typing
      hideSpellcheckLines();
      // Show them again after user stops typing
      debouncedShowSpellcheck();
    };

    el.addEventListener('input', handleInput);

    // eslint-disable-next-line consistent-return -- This return is the destructor
    return () => {
      el.removeEventListener('input', handleInput);
      // Clean up: show spellcheck lines when component unmounts
      showSpellcheckLines();
    };
  }, [debouncedShowSpellcheck, hideSpellcheckLines, showSpellcheckLines, elementRef]);

  return {
    hideSpellcheckLines,
    showSpellcheckLines,
  };
};
