import type { CSSProperties } from 'styled-components';
import styled from 'styled-components';
import { SessionDataTestId } from 'react';
import { Localizer, type LocalizerProps } from './Localizer';

const StyledI18nSubTextContainer = styled('div')`
  font-size: var(--font-size-md);
  line-height: 1.5;
  margin-bottom: var(--margins-sm);

  // TODO: we'd like the description to be on two lines instead of one when it is short.
  // setting the max-width depending on the text length is **not** the way to go.
  // We should set the width on the dialog itself, depending on what we display.
  max-width: '60ch';
  padding-inline: var(--margins-lg);
`;

export const I18nSubText = ({
  dataTestId,
  localizerProps,
  style,
}: {
  dataTestId: SessionDataTestId;
  localizerProps: LocalizerProps;
  style?: CSSProperties;
}) => {
  return (
    <StyledI18nSubTextContainer data-testid={dataTestId} style={style}>
      <Localizer {...localizerProps} />
    </StyledI18nSubTextContainer>
  );
};
