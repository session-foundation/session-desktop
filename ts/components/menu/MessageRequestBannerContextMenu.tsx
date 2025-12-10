import { Menu } from 'react-contexify';
import type { JSX } from 'react';
import { getAppDispatch } from '../../state/dispatch';

import { SessionContextMenuContainer } from '../SessionContextMenuContainer';

import { hideMessageRequestBanner } from '../../state/ducks/userConfig';
import { ItemWithDataTestId } from './items/MenuItemWithDataTestId';
import { getMenuAnimation } from './MenuAnimation';
import { tr } from '../../localization/localeTools';

export type PropsContextConversationItem = {
  triggerId: string;
};

const HideBannerMenuItem = (): JSX.Element => {
  const dispatch = getAppDispatch();
  return (
    <ItemWithDataTestId
      onClick={() => {
        dispatch(hideMessageRequestBanner());
      }}
    >
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
