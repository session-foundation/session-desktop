import { SessionDataTestId } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

import { resetConversationExternal } from '../../state/ducks/conversations';
import { updateDeleteAccountModal } from '../../state/ducks/modalDialog';
import {
  SectionType,
  setLeftOverlayMode,
  showLeftPaneSection,
  showSettingsSection,
} from '../../state/ducks/section';
import { getFocusedSettingsSection } from '../../state/selectors/section';
import { useHideRecoveryPasswordEnabled } from '../../state/selectors/settings';
import type { SessionSettingCategory } from '../../types/ReduxTypes';
import { Flex } from '../basic/Flex';
import { SessionIcon, SessionIconType } from '../icon';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';

const StyledSettingsSectionTitle = styled.span`
  font-size: var(--font-size-md);
  font-weight: 500;
  flex-grow: 1;
`;

const StyledSettingsListItem = styled(Flex)<{ active: boolean }>`
  background-color: ${props =>
    props.active
      ? 'var(--settings-tab-background-selected-color)'
      : 'var(--settings-tab-background-color)'};
  color: var(--settings-tab-text-color);
  height: 74px;
  line-height: 1;
  cursor: pointer;
  transition: var(--default-duration) !important;

  &:hover {
    background: var(--settings-tab-background-hover-color);
  }
`;

const StyledIconContainer = styled.div`
  width: 38px;
`;

type Categories = {
  id: SessionSettingCategory;
  title: string;
  dataTestId: SessionDataTestId;
  icon: {
    type: SessionIconType;
    size: number;
    color?: string;
  };
};

const getCategories = (): Array<Categories> => {
  const forcedSize = { size: 19 };
  return [
    {
      id: 'privacy' as const,
      title: window.i18n('sessionPrivacy'),
      icon: { type: 'padlock' as const, ...forcedSize },
    },
    {
      id: 'notifications' as const,
      title: window.i18n('sessionNotifications'),
      icon: { type: 'speaker' as const, ...forcedSize },
    },
    {
      id: 'conversations' as const,
      title: window.i18n('sessionConversations'),
      icon: { type: 'chatBubble' as const, ...forcedSize },
    },
    {
      id: 'message-requests' as const,
      title: window.i18n('sessionMessageRequests'),
      icon: { type: 'messageRequest' as const, ...forcedSize },
    },
    {
      id: 'appearance' as const,
      title: window.i18n('sessionAppearance'),
      icon: { type: 'paintbrush' as const, ...forcedSize },
    },
    {
      id: 'permissions' as const,
      title: window.i18n('sessionPermissions'),
      icon: { type: 'checkCircle' as const, ...forcedSize },
    },
    {
      id: 'help' as const,
      title: window.i18n('sessionHelp'),
      icon: { type: 'question' as const, ...forcedSize },
    },
    {
      id: 'recovery-password' as const,
      title: window.i18n('sessionRecoveryPassword'),
      icon: { type: 'recoveryPasswordFill' as const, ...forcedSize },
    },
    {
      id: 'clear-data' as const,
      title: window.i18n('sessionClearData'),
      icon: { type: 'delete' as const, ...forcedSize, color: 'var(--danger-color)' },
    },
  ].map(m => ({ ...m, dataTestId: `${m.id}-settings-menu-item` as const }));
};

const LeftPaneSettingsCategoryRow = ({ item }: { item: Categories }) => {
  const { id, title, icon, dataTestId } = item;
  const dispatch = useDispatch();
  const focusedSettingsSection = useSelector(getFocusedSettingsSection);

  const isClearData = id === 'clear-data';

  return (
    <StyledSettingsListItem
      key={id}
      active={id === focusedSettingsSection}
      role="link"
      $container={true}
      $flexDirection={'row'}
      $justifyContent={'flex-start'}
      $alignItems={'center'}
      $flexShrink={0}
      padding={'0px var(--margins-md) 0 var(--margins-sm)'}
      onClick={() => {
        switch (id) {
          case 'message-requests':
            dispatch(showLeftPaneSection(SectionType.Message));
            dispatch(setLeftOverlayMode('message-requests'));
            dispatch(resetConversationExternal());
            break;
          case 'clear-data':
            dispatch(updateDeleteAccountModal({}));
            break;
          default:
            dispatch(showSettingsSection(id));
        }
      }}
      data-testid={dataTestId}
    >
      <StyledIconContainer>
        <SessionIcon
          iconType={icon.type}
          iconSize={icon.size}
          sizeIsWidth={true}
          iconColor={icon.color || 'var(--text-primary-color)'}
        />
      </StyledIconContainer>
      <StyledSettingsSectionTitle style={{ color: isClearData ? 'var(--danger-color)' : 'unset' }}>
        {title}
      </StyledSettingsSectionTitle>

      {id === focusedSettingsSection && (
        <SessionIcon
          iconSize={'medium'}
          iconType="chevron"
          iconColor={'var(--text-primary-color)'}
          iconRotation={270}
        />
      )}
    </StyledSettingsListItem>
  );
};

const LeftPaneSettingsCategories = () => {
  let categories = getCategories();
  const hideRecoveryPassword = useHideRecoveryPasswordEnabled();

  if (hideRecoveryPassword) {
    categories = categories.filter(category => category.id !== 'recovery-password');
  }

  return (
    <>
      {categories.map(item => {
        return <LeftPaneSettingsCategoryRow key={item.id} item={item} />;
      })}
    </>
  );
};
const StyledContentSection = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
`;

export const LeftPaneSettingSection = () => {
  return (
    <StyledContentSection>
      <LeftPaneSectionHeader />
      <StyledContentSection>
        <LeftPaneSettingsCategories />
      </StyledContentSection>
    </StyledContentSection>
  );
};
