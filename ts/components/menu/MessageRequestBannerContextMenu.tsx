import { Menu } from 'react-contexify';
import type { JSX } from 'react';

import { SessionContextMenuContainer } from '../SessionContextMenuContainer';

import { ItemWithDataTestId } from './items/MenuItemWithDataTestId';
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
    <ItemWithDataTestId onClick={() => void hideMessageRequestsBanner()}>
      {tr('hide')}
    </ItemWithDataTestId>
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
