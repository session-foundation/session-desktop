import { useConvoIdFromContext } from '../../../../contexts/ConvoIdContext';
import {
  useConversationUsername,
  useIsKickedFromGroup,
  useIsClosedGroup,
  useIsPublic,
  useIsGroupDestroyed,
} from '../../../../hooks/useParamSelector';
import { showLeaveGroupByConvoId } from '../../../../interactions/conversationInteractions';
import { useIsMessageRequestOverlayShown } from '../../../../state/selectors/section';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { showLeaveGroupItem } from './guard';
import { Localizer } from '../../../basic/Localizer';

export const LeaveGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isGroup = useIsClosedGroup(convoId);
  const isPublic = useIsPublic(convoId);
  const username = useConversationUsername(convoId) || convoId;
  const isMessageRequestShown = useIsMessageRequestOverlayShown();
  const isKickedFromGroup = useIsKickedFromGroup(convoId) || false;
  const isGroupDestroyed = useIsGroupDestroyed(convoId);

  const showLeave = showLeaveGroupItem({
    isGroup,
    isMessageRequestShown,
    isKickedFromGroup,
    isPublic,
    isGroupDestroyed,
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
