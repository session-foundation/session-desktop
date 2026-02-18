import styled from 'styled-components';

export const LeftPaneSectionContainer = styled.div`
  width: var(--actions-panel-width);
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  flex-shrink: 0;
  padding: var(--margins-lg) 0 var(--margins-lg) 0;

  .session-icon-button {
    padding: 30px 20px;
  }
`;
