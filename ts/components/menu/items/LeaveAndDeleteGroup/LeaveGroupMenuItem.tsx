import { useConvoIdFromContext } from '../../../../contexts/ConvoIdContext';
import { MenuItem } from '../MenuItem';
import { Localizer } from '../../../basic/Localizer';
import { useShowLeaveOrDeleteGroupCb } from '../../../menuAndSettingsHooks/useShowLeaveGroup';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';

export const LeaveGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const cb = useShowLeaveOrDeleteGroupCb('leave', convoId);

  if (!cb) {
    return null;
  }

  return (
    <MenuItem onClick={cb} iconType={LUCIDE_ICONS_UNICODE.LOG_OUT} isDangerAction={true}>
      <Localizer token="groupLeave" />
    </MenuItem>
  );
};
