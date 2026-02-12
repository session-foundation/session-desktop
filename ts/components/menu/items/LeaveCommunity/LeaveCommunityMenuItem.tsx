import { useConvoIdFromContext } from '../../../../contexts/ConvoIdContext';
import { Localizer } from '../../../basic/Localizer';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { useShowLeaveCommunityCb } from '../../../menuAndSettingsHooks/useShowLeaveCommunity';
import { MenuItem } from '../MenuItem';

export const LeaveCommunityMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const cb = useShowLeaveCommunityCb(convoId);

  if (!cb) {
    return null;
  }

  return (
    <MenuItem onClick={cb} iconType={LUCIDE_ICONS_UNICODE.LOG_OUT} isDangerAction={true}>
      <Localizer token="communityLeave" />
    </MenuItem>
  );
};
