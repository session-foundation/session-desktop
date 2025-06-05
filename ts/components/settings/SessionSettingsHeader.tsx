import styled from 'styled-components';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { SettingsViewProps } from './SessionSettings';
import { localize, type MergedLocalizerTokens } from '../../localization/localeTools';

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
    case 'conversations':
      categoryTitleKey = 'sessionConversations';
      break;
    case 'notifications':
      categoryTitleKey = 'sessionNotifications';
      break;
    case 'help':
      categoryTitleKey = 'sessionHelp';
      break;
    case 'permissions':
      categoryTitleKey = 'sessionPermissions';
      break;
    case 'privacy':
      categoryTitleKey = 'sessionPrivacy';
      break;
    case 'recovery-password':
      categoryTitleKey = 'sessionRecoveryPassword';
      break;
    // these are modals or other screens
    case 'session-network':
    case 'donate':
    case 'clear-data':
    case 'message-requests':
      throw new Error(`no header for should be tried to be rendered for "${category}"`);

    default:
      assertUnreachable(category, `SettingsHeader "${category}"`);
  }

  return (
    <StyledSettingsHeader>
      <StyledHeaderTittle>
        {categoryTitleKey ? localize(categoryTitleKey) : null}
      </StyledHeaderTittle>
    </StyledSettingsHeader>
  );
};
