import type { ReactNode, SessionDataTestId } from 'react';
import styled from 'styled-components';
import { Item, ItemProps, Submenu } from 'react-contexify';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { SpacerSM } from '../../basic/Text';
import { isLucideIcon, LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { SessionIcon, type SessionIconType } from '../../icon';
import { LucideIcon } from '../../icon/LucideIcon';
import { Flex } from '../../basic/Flex';

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

const StyledItemContainer = styled(Flex)`
  &:focus-visible {
    outline: none;
    box-shadow: var(--box-shadow-focus-visible-outset);
  }
`;
export function MenuItem({
  children,
  dataTestId,
  iconType,
  isDangerAction,
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
      className={isDangerAction ? 'danger' : ''}
    >
      <StyledItemContainer
        $container={true}
        $alignItems="center"
        tabIndex={0}
        $flexGrow={1}
        height="100%"
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
    <Submenu
      label={SubMenuLabelWithIcon({ iconType, label })}
      tabIndex={0}
      style={{ '--focus-ring-size': '-2px' } as React.CSSProperties}
    >
      {children}
    </Submenu>
  );
}
