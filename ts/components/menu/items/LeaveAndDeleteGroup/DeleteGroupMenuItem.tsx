import { useConvoIdFromContext } from '../../../../contexts/ConvoIdContext';
import { useIsLegacyGroup } from '../../../../hooks/useParamSelector';
import { MenuItem } from '../MenuItem';
import { Localizer } from '../../../basic/Localizer';
import {
  useDeleteDestroyedOrKickedGroupCb,
  useShowLeaveOrDeleteGroupCb,
} from '../../../menuAndSettingsHooks/useShowLeaveGroup';
import { ConvoHub } from '../../../../session/conversations';
import { PubKey } from '../../../../session/types';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';

export const DeleteGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const showDeleteGroup = useShowLeaveOrDeleteGroupCb('delete', convoId);

  if (!showDeleteGroup) {
    return null;
  }

  return (
    <MenuItem
      onClick={showDeleteGroup}
      iconType={LUCIDE_ICONS_UNICODE.TRASH2}
      isDangerAction={true}
    >
      <Localizer token={'groupDelete'} />
    </MenuItem>
  );
};

export const DeleteDeprecatedLegacyGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const isLegacyGroup = useIsLegacyGroup(convoId);

  if (!isLegacyGroup || !PubKey.is05Pubkey(convoId)) {
    return null;
  }

  // no confirmations for deleting legacy groups anymore, we just delete them

  return (
    <MenuItem
      onClick={() => {
        void ConvoHub.use().deleteLegacyGroup(convoId, {
          fromSyncMessage: false,
          sendLeaveMessage: false,
        });
      }}
      iconType={LUCIDE_ICONS_UNICODE.TRASH2}
      isDangerAction={true}
    >
      <Localizer token={'groupDelete'} />
    </MenuItem>
  );
};

export const DeleteDestroyedOrKickedGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const cb = useDeleteDestroyedOrKickedGroupCb(convoId);

  if (!PubKey.is03Pubkey(convoId) || !cb) {
    return null;
  }

  // no confirmations for deleting legacy groups anymore, we just delete them

  return (
    <MenuItem onClick={cb} iconType={LUCIDE_ICONS_UNICODE.TRASH2} isDangerAction={true}>
      <Localizer token={'groupDelete'} />
    </MenuItem>
  );
};
