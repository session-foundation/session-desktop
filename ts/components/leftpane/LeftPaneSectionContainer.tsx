import styled from 'styled-components';

export const LeftPaneSectionContainer = styled.div`
  display: flex;
  width: 100%;
  justify-content: space-between;
  align-items: center;

  @media screen and (min-width: 799px) {
    width: var(--actions-panel-width);
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
    flex-shrink: 0;

    .session-icon-button {
      padding: 30px 20px;
    }
  }
  .mobile-active-conversation & {
    @media screen and (max-width: 679px) {
      z-index: -1;
    }
  }
`;
