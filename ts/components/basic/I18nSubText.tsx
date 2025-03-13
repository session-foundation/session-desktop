import styled from 'styled-components';
import { SessionDataTestId } from 'react';
import { Localizer } from './Localizer';
import type { LocalizerComponentPropsObject } from '../../localization/localeTools';

const StyledI18nSubTextContainer = styled('div')`
  font-size: var(--font-size-md);
  line-height: 1.5;
  margin-bottom: var(--margins-lg);

  // TODO: we'd like the description to be on two lines instead of one when it is short.
  // setting the max-width depending on the text length is **not** the way to go.
  // We should set the width on the dialog itself, depending on what we display.
  max-width: '60ch';
  padding-inline: var(--margins-lg);
`;

export const I18nSubText = ({
  className,
  dataTestId,
  localizerProps,
}: {
  className?: string;
  dataTestId: SessionDataTestId;
  localizerProps: LocalizerComponentPropsObject;
}) => {
  return (
    <StyledI18nSubTextContainer className={className} data-testid={dataTestId}>
      <Localizer {...localizerProps} />
    </StyledI18nSubTextContainer>
  );
};
