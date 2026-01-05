import { type ChangeEvent, useCallback } from 'react';

export function useUpdateInputValue(onValueChanged: (val: string) => void, disabled?: boolean) {
  return useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (disabled) {
        return;
      }
      e.preventDefault();
      const val = e.target.value;

      onValueChanged(val);
    },
    [disabled, onValueChanged]
  );
}
