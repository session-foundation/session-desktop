import { useConvoIdFromContext } from '../../../../contexts/ConvoIdContext';
import { useIsLegacyGroup } from '../../../../hooks/useParamSelector';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { Localizer } from '../../../basic/Localizer';
import {
  useDeleteDestroyedOrKickedGroupCb,
  useShowLeaveOrDeleteGroupCb,
} from '../../../menuAndSettingsHooks/useShowLeaveGroup';
import { ConvoHub } from '../../../../session/conversations';
import { PubKey } from '../../../../session/types';

export const DeleteGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const showDeleteGroup = useShowLeaveOrDeleteGroupCb('delete', convoId);

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

  const isLegacyGroup = useIsLegacyGroup(convoId);

  if (!isLegacyGroup || !PubKey.is05Pubkey(convoId)) {
    return null;
  }

  // no confirmations for deleting legacy groups anymore, we just delete them

  return (
    <ItemWithDataTestId
      onClick={() => {
        void ConvoHub.use().deleteLegacyGroup(convoId, {
          fromSyncMessage: false,
          sendLeaveMessage: false,
        });
      }}
    >
      <Localizer token={'groupDelete'} />
    </ItemWithDataTestId>
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
    <ItemWithDataTestId onClick={cb}>
      <Localizer token={'groupDelete'} />
    </ItemWithDataTestId>
  );
};
