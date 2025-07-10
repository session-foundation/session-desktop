import type { SessionDataTestId } from 'react';
import styled from 'styled-components';
import type { CSSProperties } from 'styled-components';
import { Localizer, type LocalizerProps } from '../../basic/Localizer';

const StyledModalDescriptionContainer = styled.div`
  padding: 0 var(--margins-md); // no margins top&bottom here, as it depends on if actions are displayed or not
  max-width: 500px;
  line-height: 1.2;
  text-align: center;
  font-size: var(--font-size-md);
`;

export function ModalDescription(props: {
  localizerProps: LocalizerProps;
  dataTestId: SessionDataTestId;
  style?: CSSProperties;
}) {
  return (
    <StyledModalDescriptionContainer data-testid={props.dataTestId} style={props.style}>
      <Localizer {...props.localizerProps} />
    </StyledModalDescriptionContainer>
  );
}
