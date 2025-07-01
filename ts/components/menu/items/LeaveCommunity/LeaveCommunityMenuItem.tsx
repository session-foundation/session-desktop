import { useConvoIdFromContext } from '../../../../contexts/ConvoIdContext';
import { Localizer } from '../../../basic/Localizer';
import { useShowLeaveCommunityCb } from '../../../menuAndSettingsHooks/useShowLeaveCommunity';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';

export const LeaveCommunityMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const cb = useShowLeaveCommunityCb(convoId);

  if (!cb) {
    return null;
  }

  return (
    <ItemWithDataTestId onClick={cb}>
      <Localizer token="communityLeave" />
    </ItemWithDataTestId>
  );
};
