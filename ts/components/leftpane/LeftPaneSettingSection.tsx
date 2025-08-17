import { type ReactNode, SessionDataTestId, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

import { sectionActions } from '../../state/ducks/section';
import { getFocusedSettingsSection } from '../../state/selectors/section';
import { useHideRecoveryPasswordEnabled } from '../../state/selectors/settings';
import type { SessionSettingCategory } from '../../types/ReduxTypes';
import { Flex } from '../basic/Flex';
import { SessionIcon, SessionIconType } from '../icon';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import { Localizer } from '../basic/Localizer';
import { tr } from '../../localization/localeTools';
import { LUCIDE_ICONS_UNICODE, type WithLucideUnicode } from '../icon/lucide';
import { LucideIcon } from '../icon/LucideIcon';
import { ProIconButton } from '../buttons/ProButton';

const StyledSettingsSectionTitle = styled.span<{
  color?: string;
  isNew?: boolean;
}>`
  font-size: var(--font-size-md);
  font-weight: 500;
  color: ${props => props.color};
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
  width: 58px;
  place-items: center;
  text-align: center;
`;

const StyledNewItem = styled.span`
  color: var(--renderer-span-primary-color);
  font-size: var(--font-size-sm);
  font-weight: 400;
  margin-inline-start: var(--margins-xs);
`;

type CategoryIcon = { color?: string } & (
  | {
      type: SessionIconType;
    }
  | (WithLucideUnicode & {
      type: 'lucide';
    })
  | {
      type: 'custom';
      content: 'sessionPro';
    }
);

type Categories = {
  id: SessionSettingCategory;
  title: ReactNode;
  titleColor?: string;
  titleColorLightTheme?: string;
  dataTestId: SessionDataTestId;
  icon: CategoryIcon;
  isNew?: boolean;
};

const categories: Array<Categories> = (
  [
    {
      id: 'conversations',
      title: tr('sessionConversations'),
      icon: { type: 'lucide', unicode: LUCIDE_ICONS_UNICODE.MESSAGE_SQUARE },
    },
    {
      id: 'appearance',
      title: tr('sessionAppearance'),
      icon: { type: 'lucide', unicode: LUCIDE_ICONS_UNICODE.PAINTBRUSH_VERTICAL },
    },
    {
      id: 'permissions',
      title: tr('sessionPermissions'),
      icon: { type: 'lucide', unicode: LUCIDE_ICONS_UNICODE.CIRCLE_CHECK },
    },
  ] as const satisfies Array<Omit<Categories, 'dataTestId'>>
).map(m => ({
  ...m,
  dataTestId: `${m.id}-settings-menu-item` as const,
})) satisfies Array<Categories>;

const LeftPaneSettingsCategoryRow = ({ item }: { item: Categories }) => {
  const { id, title, titleColor, icon, dataTestId, isNew } = item;
  const dispatch = useDispatch();
  const focusedSettingsSection = useSelector(getFocusedSettingsSection);

  const isSelected = useMemo(() => focusedSettingsSection === id, [focusedSettingsSection, id]);

  const iconSize = 'medium';

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
      padding={'0 var(--margins-xs)'}
      onClick={() => {
        switch (id) {
          default:
            dispatch(sectionActions.showSettingsSection(id));
        }
      }}
      data-testid={dataTestId}
    >
      <StyledIconContainer>
        {icon.type === 'lucide' ? (
          <LucideIcon unicode={icon.unicode} iconSize={iconSize} iconColor={icon.color} />
        ) : icon.type === 'custom' ? (
          <ProIconButton onClick={undefined} iconSize="small" dataTestId="invalid-data-testid" />
        ) : (
          <SessionIcon
            iconType={icon.type}
            iconSize={iconSize}
            sizeIsWidth={true}
            iconColor={icon.color || 'var(--text-primary-color)'}
          />
        )}
      </StyledIconContainer>
      <StyledSettingsSectionTitle color={titleColor} isNew={isNew}>
        {title}
      </StyledSettingsSectionTitle>

      {isNew ? (
        <StyledNewItem>
          <Localizer token="sessionNew" />
        </StyledNewItem>
      ) : null}

      {isSelected ? (
        <LucideIcon
          iconSize={iconSize}
          unicode={LUCIDE_ICONS_UNICODE.CHEVRON_RIGHT}
          style={{ marginInlineStart: 'auto' }}
        />
      ) : null}
    </StyledSettingsListItem>
  );
};

const LeftPaneSettingsCategories = () => {
  const hideRecoveryPassword = useHideRecoveryPasswordEnabled();

  const settingsCategories = categories.filter(
    category => !hideRecoveryPassword || category.id !== 'recovery-password'
  );

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
