import type { JSX } from 'react';

import { useConvoIdFromContext } from '../../../../contexts/ConvoIdContext';
import {
  useHasUnread,
  useIsForcedUnreadWithoutUnreadMsg,
  useIsIncomingRequest,
  useIsPrivate,
  useIsPrivateAndFriend,
} from '../../../../hooks/useParamSelector';
import { markAllReadByConvoId } from '../../../../interactions/conversationInteractions';
import { ConvoHub } from '../../../../session/conversations';
import { PubKey } from '../../../../session/types';
import { useIsMessageRequestOverlayShown } from '../../../../state/selectors/section';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { MailWithUnreadIcon } from '../../../icon/MailWithUnreadIcon';
import { MenuItem } from '../MenuItem';
import { tr } from '../../../../localization';

export const MarkAllReadMenuItem = (): JSX.Element | null => {
  const conversationId = useConvoIdFromContext();
  const isIncomingRequest = useIsIncomingRequest(conversationId);
  const hasUnread = useHasUnread(conversationId);
  const forcedUnread = useIsForcedUnreadWithoutUnreadMsg(conversationId);
  const unreadOrForcedUnread = hasUnread || forcedUnread;

  if (!isIncomingRequest && !PubKey.isBlinded(conversationId) && unreadOrForcedUnread) {
    return (
      <MenuItem
        onClick={() => {
          void markAllReadByConvoId(conversationId);
        }}
        iconType={LUCIDE_ICONS_UNICODE.MAIL_OPEN}
        isDangerAction={false}
      >
        {tr('messageMarkRead')}
      </MenuItem>
    );
  }
  return null;
};

export const MarkConversationUnreadMenuItem = (): JSX.Element | null => {
  const conversationId = useConvoIdFromContext();
  const isPrivate = useIsPrivate(conversationId);
  const isPrivateAndFriend = useIsPrivateAndFriend(conversationId);
  const isMessageRequestShown = useIsMessageRequestOverlayShown();
  // to be able to mark as unread it needs to either have unread messages or be forced unread
  const hasUnread = useHasUnread(conversationId);
  const forcedUnread = useIsForcedUnreadWithoutUnreadMsg(conversationId);
  const unreadOrForcedUnread = hasUnread || forcedUnread;

  if (
    !isMessageRequestShown &&
    !unreadOrForcedUnread &&
    (!isPrivate || (isPrivate && isPrivateAndFriend))
  ) {
    const conversation = ConvoHub.use().get(conversationId);

    const markUnread = () => {
      void conversation?.markAsUnread(true);
    };

    return (
      <MenuItem
        onClick={markUnread}
        iconType={<MailWithUnreadIcon iconSize="medium" />}
        isDangerAction={false}
      >
        {tr('messageMarkUnread')}
      </MenuItem>
    );
  }
  return null;
};
