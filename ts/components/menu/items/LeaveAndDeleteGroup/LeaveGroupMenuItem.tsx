import { useConvoIdFromContext } from '../../../../contexts/ConvoIdContext';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { Localizer } from '../../../basic/Localizer';
import { useShowLeaveOrDeleteGroupCb } from '../../../menuAndSettingsHooks/useShowLeaveGroup';

export const LeaveGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const cb = useShowLeaveOrDeleteGroupCb('leave', convoId);

  if (!cb) {
    return null;
  }

  return (
    <ItemWithDataTestId onClick={cb}>
      <Localizer token="groupLeave" />
    </ItemWithDataTestId>
  );
};
