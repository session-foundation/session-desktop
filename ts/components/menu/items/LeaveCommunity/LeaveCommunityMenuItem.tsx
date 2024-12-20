import { useConvoIdFromContext } from '../../../../contexts/ConvoIdContext';
import { useConversationUsername, useIsPublic } from '../../../../hooks/useParamSelector';
import { showLeaveGroupByConvoId } from '../../../../interactions/conversationInteractions';
import { Localizer } from '../../../basic/Localizer';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { showLeaveCommunityItem } from './guard';

export const LeaveCommunityMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const username = useConversationUsername(convoId) || convoId;
  const isPublic = useIsPublic(convoId);

  if (!showLeaveCommunityItem({ isPublic })) {
    return null;
  }

  return (
    <ItemWithDataTestId
      onClick={() => {
        void showLeaveGroupByConvoId(convoId, username);
      }}
    >
      <Localizer token="communityLeave" />
    </ItemWithDataTestId>
  );
};
