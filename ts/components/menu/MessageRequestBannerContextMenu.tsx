import { Menu } from 'react-contexify';
import type { JSX } from 'react';

import { SessionContextMenuContainer } from '../SessionContextMenuContainer';

import { MenuItem } from './items/MenuItem';
import { getMenuAnimation } from './MenuAnimation';
import { tr } from '../../localization/localeTools';
import { SettingsKey } from '../../data/settings-key';

export type PropsContextConversationItem = {
  triggerId: string;
};

async function hideMessageRequestsBanner() {
  await window.setSettingValue(SettingsKey.hideMessageRequests, true);
}

const HideBannerMenuItem = (): JSX.Element => {
  return (
    <MenuItem
      onClick={() => void hideMessageRequestsBanner()}
      iconType={null}
      isDangerAction={false}
    >
      {tr('hide')}
    </MenuItem>
  );
};

export const MessageRequestBannerContextMenu = (props: PropsContextConversationItem) => {
  const { triggerId } = props;

  return (
    <SessionContextMenuContainer>
      <Menu id={triggerId} animation={getMenuAnimation()}>
        <HideBannerMenuItem />
      </Menu>
    </SessionContextMenuContainer>
  );
};
