import styled from 'styled-components';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { SettingsViewProps } from './SessionSettings';
import { tr, type MergedLocalizerTokens } from '../../localization/localeTools';

type Props = Pick<SettingsViewProps, 'category'>;

const StyledSettingsHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  height: var(--main-view-header-height);
`;

const StyledHeaderTittle = styled.div`
  line-height: var(--main-view-header-height);
  font-weight: bold;
  font-size: var(--font-size-lg);
  text-align: center;
  flex-grow: 1;
`;

export const SettingsHeader = (props: Props) => {
  const { category } = props;

  let categoryTitleKey: MergedLocalizerTokens | null = null;
  switch (category) {
    case 'appearance':
      categoryTitleKey = 'sessionAppearance';
      break;
    case 'recovery-password':
      categoryTitleKey = 'sessionRecoveryPassword';
      break;
    default:
      assertUnreachable(category, `SettingsHeader "${category}"`);
  }

  return (
    <StyledSettingsHeader>
      <StyledHeaderTittle>{categoryTitleKey ? tr(categoryTitleKey) : null}</StyledHeaderTittle>
    </StyledSettingsHeader>
  );
};
