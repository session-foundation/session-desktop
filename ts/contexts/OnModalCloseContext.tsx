import { createContext, useContext } from 'react';

export const OnModalCloseContext = createContext<(() => void) | null>(null);

export function useOnModalClose() {
  return useContext(OnModalCloseContext);
}
