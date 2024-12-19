import { useSelector } from 'react-redux';
import { useConvoIdFromContext } from '../../../../contexts/ConvoIdContext';
import {
  useConversationUsername,
  useIsKickedFromGroup,
  useIsClosedGroup,
  useLastMessageIsLeaveError,
} from '../../../../hooks/useParamSelector';
import { showLeaveGroupByConvoId } from '../../../../interactions/conversationInteractions';
import { PubKey } from '../../../../session/types';
import { getIsMessageRequestOverlayShown } from '../../../../state/selectors/section';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { showDeleteGroupItem } from './guard';
import { Localizer } from '../../../basic/Localizer';

export const DeleteGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const username = useConversationUsername(convoId) || convoId;
  const isGroup = useIsClosedGroup(convoId);
  const isMessageRequestShown = useSelector(getIsMessageRequestOverlayShown);
  const isKickedFromGroup = useIsKickedFromGroup(convoId) || false;
  const lastMessageIsLeaveError = useLastMessageIsLeaveError(convoId);

  const showLeave = showDeleteGroupItem({
    isGroup,
    isKickedFromGroup,
    isMessageRequestShown,
    lastMessageIsLeaveError,
  });

  if (!showLeave) {
    return null;
  }

  const token = PubKey.is03Pubkey(convoId) ? 'groupDelete' : 'conversationsDelete';

  return (
    <ItemWithDataTestId
      onClick={() => {
        void showLeaveGroupByConvoId(convoId, username);
      }}
    >
      <Localizer token={token} />
    </ItemWithDataTestId>
  );
};
