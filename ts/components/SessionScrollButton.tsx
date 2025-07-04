import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { getShowScrollButton } from '../state/selectors/conversations';

import { useSelectedUnreadCount } from '../state/selectors/selectedConversation';
import { SessionUnreadCount } from './icon/SessionNotificationCount';
import { SessionLucideIconButton } from './icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from './icon/lucide';

const SessionScrollButtonDiv = styled.div`
  position: fixed;
  z-index: 2;
  right: 60px;
  animation: fadein var(--default-duration);
`;

export const SessionScrollButton = (props: { onClickScrollBottom: () => void }) => {
  const show = useSelector(getShowScrollButton);
  const unreadCount = useSelectedUnreadCount();

  return (
    <SessionScrollButtonDiv>
      {show ? (
        <SessionLucideIconButton
          unicode={LUCIDE_ICONS_UNICODE.CHEVRON_DOWN}
          iconSize={'large'}
          onClick={props.onClickScrollBottom}
          dataTestId="scroll-to-bottom-button"
          backgroundColor="var(--message-bubbles-received-background-color)"
          padding="var(--margins-xs)"
          style={{
            boxShadow: 'var(--scroll-button-shadow)',
          }}
        >
          {Boolean(unreadCount) && <SessionUnreadCount count={unreadCount} />}
        </SessionLucideIconButton>
      ) : null}
    </SessionScrollButtonDiv>
  );
};
