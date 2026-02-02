import { createContext, RefObject, useContext } from 'react';

export const MessagesContainerRefContext = createContext<RefObject<HTMLDivElement | null>>({
  current: null,
});

export const useMessagesContainerRef = () => {
  return useContext(MessagesContainerRefContext);
};
