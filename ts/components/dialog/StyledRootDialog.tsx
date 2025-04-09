import styled from 'styled-components';

export const StyledRootDialog = styled.div<{ shouldOverflow: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;

  position: absolute;
  top: 0;
  left: 0;
  height: 100vh;
  width: 100vw;
  background-color: var(--modal-background-color);
  padding: 5vh var(--margins-lg);
  z-index: 100;
  overflow-y: ${props => (props.shouldOverflow ? 'auto' : 'hidden')};

  & ~ .index.inbox {
    transition: filter var(--duration-modal-to-inbox);
  }
`;
