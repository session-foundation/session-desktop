import { createContext, useContext } from 'react';

export const ModalHasActionButtonContext = createContext<boolean>(false);

export const useModalHasActionButtonContext = () => {
  return useContext(ModalHasActionButtonContext);
};
