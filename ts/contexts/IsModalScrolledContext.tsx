import { createContext, useContext } from 'react';

export const IsModalScrolledContext = createContext<boolean>(false);

export const useIsModalScrolled = () => {
  return useContext(IsModalScrolledContext);
};
