import { useConvoIdFromContext } from '../../../../contexts/ConvoIdContext';
import { useConversationUsername, useIsLegacyGroup } from '../../../../hooks/useParamSelector';
import { showDeleteGroupByConvoId } from '../../../../interactions/conversationInteractions';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { Localizer } from '../../../basic/Localizer';
import { useShowDeleteGroupCb } from '../../../menuAndSettingsHooks/useShowLeaveGroup';

export const DeleteGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const showDeleteGroup = useShowDeleteGroupCb(convoId);

  if (!showDeleteGroup) {
    return null;
  }

  return (
    <ItemWithDataTestId onClick={showDeleteGroup}>
      <Localizer token={'groupDelete'} />
    </ItemWithDataTestId>
  );
};

export const DeleteDeprecatedLegacyGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const username = useConversationUsername(convoId) || convoId;

  const isLegacyGroup = useIsLegacyGroup(convoId);

  if (!isLegacyGroup) {
    return null;
  }

  return (
    <ItemWithDataTestId
      onClick={() => {
        void showDeleteGroupByConvoId(convoId, username);
      }}
    >
      <Localizer token={'groupDelete'} />
    </ItemWithDataTestId>
  );
};
