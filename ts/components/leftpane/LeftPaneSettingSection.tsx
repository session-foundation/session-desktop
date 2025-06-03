import { SessionDataTestId, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

import { resetConversationExternal } from '../../state/ducks/conversations';
import { updateDeleteAccountModal, updateSessionNetworkModal } from '../../state/ducks/modalDialog';
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
import { getSessionNetworkModalState } from '../../state/selectors/modal';
import { LOCALE_DEFAULTS } from '../../localization/constants';
import { Localizer } from '../basic/Localizer';
import { localize } from '../../localization/localeTools';
import { useIsSesh101Ready } from '../../state/selectors/releasedFeatures';
import { networkDataActions } from '../../state/ducks/networkData';

const StyledSettingsSectionTitle = styled.span<{ isClearData: boolean; isNew?: boolean }>`
  font-size: var(--font-size-md);
  font-weight: 500;
  color: ${props => props.isClearData && 'var(--danger-color)'};
  flex-grow: ${props => !props.isNew && 1};
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

const StyledNewItem = styled.span`
  color: var(--renderer-span-primary-color);
  font-size: var(--font-size-sm);
  font-weight: 400;
  margin-inline-start: var(--margins-xs);
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
  isNew?: boolean;
};

const getCategories = (): Array<Categories> => {
  const forcedSize = { size: 19 };
  return [
    {
      id: 'privacy' as const,
      title: localize('sessionPrivacy').toString(),
      icon: { type: 'padlock' as const, ...forcedSize },
    },
    {
      id: 'notifications' as const,
      title: localize('sessionNotifications').toString(),
      icon: { type: 'speaker' as const, ...forcedSize },
    },
    {
      id: 'conversations' as const,
      title: localize('sessionConversations').toString(),
      icon: { type: 'chatBubble' as const, ...forcedSize },
    },
    {
      id: 'message-requests' as const,
      title: localize('sessionMessageRequests').toString(),
      icon: { type: 'messageRequest' as const, ...forcedSize },
    },
    {
      id: 'appearance' as const,
      title: localize('sessionAppearance').toString(),
      icon: { type: 'paintbrush' as const, ...forcedSize },
    },
    {
      id: 'permissions' as const,
      title: localize('sessionPermissions').toString(),
      icon: { type: 'checkCircle' as const, ...forcedSize },
    },
    {
      id: 'session-network' as const,
      title: LOCALE_DEFAULTS.network_name,
      icon: { type: 'sentToken' as const, ...forcedSize },
      isNew: true,
    },
    {
      id: 'recovery-password' as const,
      title: localize('sessionRecoveryPassword').toString(),
      icon: { type: 'recoveryPasswordFill' as const, ...forcedSize },
    },
    {
      id: 'help' as const,
      title: localize('sessionHelp').toString(),
      icon: { type: 'question' as const, ...forcedSize },
    },
    {
      id: 'clear-data' as const,
      title: localize('sessionClearData').toString(),
      icon: { type: 'delete' as const, ...forcedSize, color: 'var(--danger-color)' },
    },
  ].map(m => ({ ...m, dataTestId: `${m.id}-settings-menu-item` as const }));
};

const LeftPaneSettingsCategoryRow = ({ item }: { item: Categories }) => {
  const { id, title, icon, dataTestId, isNew } = item;
  const dispatch = useDispatch();
  const focusedSettingsSection = useSelector(getFocusedSettingsSection);
  const sessionNetworkModalState = useSelector(getSessionNetworkModalState);

  const isSelected = useMemo(
    () => (sessionNetworkModalState ? id === 'session-network' : focusedSettingsSection === id),
    [focusedSettingsSection, id, sessionNetworkModalState]
  );

  const isClearData = id === 'clear-data';

  return (
    <StyledSettingsListItem
      key={id}
      active={isSelected}
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
          case 'session-network':
            // if the network modal is not open yet do an info request
            if (focusedSettingsSection !== 'session-network') {
              dispatch(networkDataActions.refreshInfoFromSeshServer() as any);
            }
            dispatch(updateSessionNetworkModal({}));
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
      <StyledSettingsSectionTitle isClearData={isClearData} isNew={isNew}>
        {title}
      </StyledSettingsSectionTitle>

      {isNew ? (
        <StyledNewItem>
          <Localizer token="sessionNew" />
        </StyledNewItem>
      ) : null}

      {isSelected && (
        <SessionIcon
          iconSize={'medium'}
          iconType="chevron"
          iconColor={'var(--text-primary-color)'}
          iconRotation={270}
          style={{ marginInlineStart: 'auto' }}
        />
      )}
    </StyledSettingsListItem>
  );
};

const LeftPaneSettingsCategories = () => {
  const hideRecoveryPassword = useHideRecoveryPasswordEnabled();
  const isSesh101Released = useIsSesh101Ready();

  const settingsCategories = getCategories()
    .filter(category => !hideRecoveryPassword || category.id !== 'recovery-password')
    // TODO[epic=SES-2606] remove after feature release
    .filter(category => isSesh101Released || category.id !== 'session-network');

  return (
    <>
      {settingsCategories.map(item => {
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
