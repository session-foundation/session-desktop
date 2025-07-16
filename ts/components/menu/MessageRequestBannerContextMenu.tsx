import { Menu } from 'react-contexify';
import { useDispatch } from 'react-redux';

import { SessionContextMenuContainer } from '../SessionContextMenuContainer';

import { hideMessageRequestBanner } from '../../state/ducks/userConfig';
import { ItemWithDataTestId } from './items/MenuItemWithDataTestId';
import { getMenuAnimation } from './MenuAnimation';

export type PropsContextConversationItem = {
  triggerId: string;
};

const HideBannerMenuItem = (): JSX.Element => {
  const dispatch = useDispatch();
  return (
    <ItemWithDataTestId
      onClick={() => {
        dispatch(hideMessageRequestBanner());
      }}
    >
      {window.i18n('hide')}
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
