import type { JSX } from 'react';

import { SessionContextMenuContainer } from '../SessionContextMenuContainer';

import { MenuItem, Menu } from './items/MenuItem';
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
      <Menu id={triggerId}>
        <HideBannerMenuItem />
      </Menu>
    </SessionContextMenuContainer>
  );
};
