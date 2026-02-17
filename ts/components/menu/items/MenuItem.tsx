import type { ReactNode, SessionDataTestId } from 'react';
import styled from 'styled-components';
import {
  Item,
  ItemProps,
  Menu as MenuOriginal,
  Submenu,
  type ItemParams,
  type MenuProps,
} from 'react-contexify';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { SpacerSM } from '../../basic/Text';
import { isLucideIcon, LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { SessionIcon, type SessionIconType } from '../../icon';
import { LucideIcon } from '../../icon/LucideIcon';
import { Flex } from '../../basic/Flex';
import { getMenuAnimation } from '../MenuAnimation';
import { closeContextMenus } from '../../../util/contextMenu';

function isReactNode(
  iconType: LUCIDE_ICONS_UNICODE | SessionIconType | ReactNode | null
): iconType is ReactNode {
  return typeof iconType === 'object';
}

function MenuItemIcon({
  iconType,
}: {
  iconType: LUCIDE_ICONS_UNICODE | SessionIconType | ReactNode | null;
}) {
  if (!iconType) {
    return null;
  }

  if (isReactNode(iconType)) {
    return (
      <>
        {iconType}
        <SpacerSM />
      </>
    );
  }

  return isLucideIcon(iconType) ? (
    <>
      <LucideIcon unicode={iconType} iconSize="medium" iconColor="currentColor" />
      <SpacerSM />
    </>
  ) : (
    <>
      <SessionIcon iconType={iconType} iconSize="medium" iconColor="currentColor" />
      <SpacerSM />
    </>
  );
}

const StyledItemContainer = styled(Flex)<{ $isDangerAction: boolean }>`
  &:focus-visible {
    outline: ${props =>
      props.$isDangerAction
        ? '2px solid var(--danger-color)'
        : '2px solid var(--text-primary-color)'};
    box-shadow: none;
    outline-offset: var(--margins-xs);
  }
`;

export function MenuItem({
  children,
  dataTestId,
  iconType,
  isDangerAction,
  onClick,
  ...props
}: Omit<ItemProps, 'data-testid'> & {
  dataTestId?: SessionDataTestId;
  iconType: LUCIDE_ICONS_UNICODE | SessionIconType | ReactNode | null;
  isDangerAction: boolean;
}) {
  return (
    <Item
      data-testid={dataTestId || 'context-menu-item'}
      {...props}
      onClick={(args: ItemParams) => {
        if (onClick) {
          onClick(args);
          closeContextMenus();
        }
      }}
      className={isDangerAction ? 'danger' : ''}
    >
      <StyledItemContainer
        $container={true}
        $alignItems="center"
        $flexGrow={1}
        height="100%"
        tabIndex={0}
        $isDangerAction={isDangerAction}
      >
        <MenuItemIcon iconType={iconType} />
        {children}
      </StyledItemContainer>
    </Item>
  );
}

function SubMenuLabelWithIcon({
  iconType,
  label,
}: {
  label: string;
  iconType: LUCIDE_ICONS_UNICODE;
}) {
  if (!iconType) {
    return label;
  }
  return (
    <>
      {isLucideIcon(iconType) ? (
        <SessionLucideIconButton iconSize="medium" unicode={iconType} iconColor="currentColor" />
      ) : null}

      <SpacerSM />
      {label}
    </>
  );
}

export function SubMenuItem({
  children,
  iconType,
  label,
}: Omit<ItemProps, 'data-testid'> & {
  iconType: LUCIDE_ICONS_UNICODE;
  label: string;
}) {
  return (
    <Submenu label={SubMenuLabelWithIcon({ iconType, label })} tabIndex={0}>
      {children}
    </Submenu>
  );
}

export function Menu(opts: Omit<MenuProps, 'animation'>) {
  return <MenuOriginal {...opts} animation={getMenuAnimation()} />;
}
