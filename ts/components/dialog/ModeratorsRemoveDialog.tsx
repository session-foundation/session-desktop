import { compact } from 'lodash';
import { useState } from 'react';
import { useDispatch } from 'react-redux';

import { ConvoHub } from '../../session/conversations';
import { PubKey } from '../../session/types';
import { ToastUtils } from '../../session/utils';

import { useGroupAdmins, useIsPublic, useWeAreAdmin } from '../../hooks/useParamSelector';
import { sogsV3RemoveAdmins } from '../../session/apis/open_group_api/sogsv3/sogsV3AddRemoveMods';
import { updateRemoveModeratorsModal } from '../../state/ducks/modalDialog';
import { MemberListItem } from '../MemberListItem';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../loading';
import { Localizer } from '../basic/Localizer';
import { StyledContactListInModal } from '../list/StyledContactList';
import {
  BasicModalHeader,
  ModalActionsContainer,
  SessionWrapperModal2,
} from '../SessionWrapperModal2';
import { localize } from '../../localization/localeTools';

type Props = {
  conversationId: string;
};

async function removeMods(convoId: string, modsToRemove: Array<string>) {
  if (modsToRemove.length === 0) {
    window?.log?.info('No moderators removed. Nothing todo');
    return false;
  }
  window?.log?.info(`asked to remove moderators: ${modsToRemove}`);
  const modsToRemovePubkey = compact(modsToRemove.map(m => PubKey.from(m)));
  const modsToRemoveNames = modsToRemovePubkey.map(
    m =>
      ConvoHub.use().get(m.key)?.getNicknameOrRealUsernameOrPlaceholder() ||
      localize('unknown').toString()
  );
  try {
    const convo = ConvoHub.use().get(convoId);

    const roomInfos = convo.toOpenGroupV2();

    const res = await sogsV3RemoveAdmins(modsToRemovePubkey, roomInfos);

    if (!res) {
      window?.log?.warn('failed to remove moderators:', res);

      ToastUtils.pushFailedToRemoveFromModerator(modsToRemoveNames);
      return false;
    }
    window?.log?.info(`${modsToRemove} removed from moderators...`);
    ToastUtils.pushUserRemovedFromModerators(modsToRemoveNames);
    return true;
  } catch (e) {
    window?.log?.error('Got error while removing moderator:', e);
    return false;
  }
}

export const RemoveModeratorsDialog = (props: Props) => {
  const { conversationId } = props;
  const [removingInProgress, setRemovingInProgress] = useState(false);
  const [modsToRemove, setModsToRemove] = useState<Array<string>>([]);
  const dispatch = useDispatch();
  const closeDialog = () => {
    dispatch(updateRemoveModeratorsModal(null));
  };

  const weAreAdmin = useWeAreAdmin(conversationId);
  const isPublic = useIsPublic(conversationId);
  const groupAdmins = useGroupAdmins(conversationId);

  const removeModsCall = async () => {
    if (modsToRemove.length) {
      setRemovingInProgress(true);
      const removed = await removeMods(conversationId, modsToRemove);
      setRemovingInProgress(false);
      if (removed) {
        closeDialog();
      }
    }
  };

  if (!isPublic || !weAreAdmin) {
    throw new Error('RemoveModeratorsDialog: convoProps invalid');
  }

  const existingMods = groupAdmins || [];
  const hasMods = existingMods.length !== 0;

  return (
    <SessionWrapperModal2
      headerChildren={<BasicModalHeader title={localize('adminRemove').toString()} />}
      onClose={closeDialog}
      buttonChildren={
        <ModalActionsContainer>
          <SessionButton
            buttonType={SessionButtonType.Simple}
            onClick={removeModsCall}
            disabled={removingInProgress}
            text={localize('remove').toString()}
          />
          <SessionButton
            buttonType={SessionButtonType.Simple}
            buttonColor={SessionButtonColor.Danger}
            onClick={closeDialog}
            disabled={removingInProgress}
            text={localize('cancel').toString()}
          />
        </ModalActionsContainer>
      }
    >
      {hasMods ? (
        <StyledContactListInModal>
          {existingMods.map(modId => (
            <MemberListItem
              key={`mod-list-${modId}`}
              pubkey={modId}
              isSelected={modsToRemove.some(m => m === modId)}
              onSelect={(selectedMember: string) => {
                const updatedList = [...modsToRemove, selectedMember];
                setModsToRemove(updatedList);
              }}
              onUnselect={(selectedMember: string) => {
                const updatedList = modsToRemove.filter(m => m !== selectedMember);
                setModsToRemove(updatedList);
              }}
              disableBg={true}
              maxNameWidth="100%"
            />
          ))}
        </StyledContactListInModal>
      ) : (
        <p>
          <Localizer token="adminRemoveCommunityNone" />
        </p>
      )}

      <SessionSpinner loading={removingInProgress} />
    </SessionWrapperModal2>
  );
};
