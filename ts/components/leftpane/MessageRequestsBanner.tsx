import { MouseEvent, ReactNode } from 'react';
import { contextMenu } from 'react-contexify';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { getUnreadConversationRequests } from '../../state/selectors/conversations';
import { useIsSearchingForType } from '../../state/selectors/search';
import { MessageRequestBannerContextMenu } from '../menu/MessageRequestBannerContextMenu';
import { Localizer } from '../basic/Localizer';
import { LucideIcon } from '../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { getHideMessageRequestBanner } from '../../state/selectors/settings';

const StyledMessageRequestBanner = styled.div`
  // The conversation list item row is set to 64px height
  height: 64px;
  min-height: 64px;
`;

const StyledMessageRequestBannerHeader = styled.span`
  font-weight: bold;
  font-size: var(--font-size-md);
  color: var(--text-primary-color);
  line-height: 18px;
  overflow-x: hidden;
  overflow-y: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  flex-grow: 1;
  display: flex;
  flex-direction: row;
`;

const StyledUnreadCounter = styled.div`
  font-weight: bold;
  border-radius: var(--margins-sm);
  color: var(--unread-messages-alert-text-color);
  background-color: var(--unread-messages-alert-background-color);
  margin-left: var(--margins-xs);
  min-width: 20px;
  height: 20px;
  line-height: 20px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: var(--margins-xs);
`;

const StyledGridContainer = styled.div`
  display: flex;
  width: 36px;
  height: 36px;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  background-color: var(--primary-color);
`;

export const MessageRequestsBanner = (props: { handleOnClick: () => any }) => {
  const { handleOnClick } = props;
  const conversationRequestsUnread = useSelector(getUnreadConversationRequests).length;
  const hideRequestBanner = useSelector(getHideMessageRequestBanner);

  // when searching hide the message request banner
  const isCurrentlySearching = useIsSearchingForType('global');

  if (!conversationRequestsUnread || hideRequestBanner || isCurrentlySearching) {
    return null;
  }

  const triggerId = 'msg-req-banner';

  const handleOnContextMenu = (e: any) => {
    contextMenu.show({
      id: triggerId,
      event: e,
    });
  };

  const openRequests = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button === 0) {
      handleOnClick();
    }
  };

  return (
    <>
      <StyledMessageRequestBanner
        className="module-conversation-list-item"
        onContextMenu={handleOnContextMenu}
        onClick={openRequests}
        onMouseUp={e => {
          e.stopPropagation();
          e.preventDefault();
        }}
        data-testid="message-request-banner"
      >
        <StyledGridContainer>
          <LucideIcon
            unicode={LUCIDE_ICONS_UNICODE.MESSAGE_SQUARE_WARNING}
            iconSize="medium"
            iconColor="var(--black-color)"
          />
        </StyledGridContainer>
        <StyledMessageRequestBannerHeader className="module-conversation-list-item__content">
          <Localizer token="sessionMessageRequests" />
          <StyledUnreadCounter>
            <div>{conversationRequestsUnread || 0}</div>
          </StyledUnreadCounter>
        </StyledMessageRequestBannerHeader>
      </StyledMessageRequestBanner>
      <Portal>
        <MessageRequestBannerContextMenu triggerId={triggerId} />
      </Portal>
    </>
  );
};

const Portal = ({ children }: { children: ReactNode }) => {
  return createPortal(children, document.querySelector('.inbox.index') as Element);
};
