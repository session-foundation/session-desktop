import { useSelector } from 'react-redux';
import { useConvoIdFromContext } from '../../../../contexts/ConvoIdContext';
import {
  useConversationUsername,
  useIsKickedFromGroup,
  useIsClosedGroup,
  useLastMessageIsLeaveError,
} from '../../../../hooks/useParamSelector';
import { showLeaveGroupByConvoId } from '../../../../interactions/conversationInteractions';
import { getIsMessageRequestOverlayShown } from '../../../../state/selectors/section';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { showLeaveGroupItem } from './guard';
import { Localizer } from '../../../basic/Localizer';

export const LeaveGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isGroup = useIsClosedGroup(convoId);
  const username = useConversationUsername(convoId) || convoId;
  const isMessageRequestShown = useSelector(getIsMessageRequestOverlayShown);
  const isKickedFromGroup = useIsKickedFromGroup(convoId) || false;
  const lastMessageIsLeaveError = useLastMessageIsLeaveError(convoId);

  const showLeave = showLeaveGroupItem({
    isGroup,
    isMessageRequestShown,
    isKickedFromGroup,
    lastMessageIsLeaveError,
  });

  if (!showLeave) {
    return null;
  }

  return (
    <ItemWithDataTestId
      onClick={() => {
        void showLeaveGroupByConvoId(convoId, username);
      }}
    >
      <Localizer token="groupLeave" />
    </ItemWithDataTestId>
  );
};
