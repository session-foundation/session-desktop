import type { ReactNode } from 'react';
import { Flex } from '../../basic/Flex';

/**
 * A basic flex container used for modals specifically.
 * We want a gap of var(--margins-md) for the items in the content of the modal.
 */
export const ModalFlexContainer = ({ children }: { children: ReactNode }) => {
  return (
    <Flex
      $container={true}
      $flexDirection="column"
      $alignItems="center"
      width="100%"
      $flexGap="var(--margins-md)"
    >
      {children}
    </Flex>
  );
};
