import styled from 'styled-components';

export const LeftPaneSectionContainer = styled.div`
  width: var(--actions-panel-width);
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;

  .session-icon-button {
    padding: 30px 20px;
  }

  .module-avatar {
    display: flex;
    align-items: center;
  }

  // this is not ideal but it seems that nth-0last-child does not work
  #onion-path-indicator-led-id {
    margin: auto auto 0px auto;
    opacity: 1;
  }
`;
