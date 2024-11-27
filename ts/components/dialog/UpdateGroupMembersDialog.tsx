import _, { difference } from 'lodash';
import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { PubkeyType } from 'libsession_util_nodejs';
import { ToastUtils, UserUtils } from '../../session/utils';

import { updateGroupMembersModal } from '../../state/ducks/modalDialog';
import { MemberListItem } from '../MemberListItem';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerLG } from '../basic/Text';

import {
  useGroupAdmins,
  useIsPrivate,
  useIsPublic,
  useSortedGroupMembers,
  useWeAreAdmin,
} from '../../hooks/useParamSelector';

import { useSet } from '../../hooks/useSet';
import { ConvoHub } from '../../session/conversations';
import { ClosedGroup } from '../../session/group/closed-group';
import { PubKey } from '../../session/types';
import { hasClosedGroupV2QAButtons } from '../../shared/env_vars';
import { groupInfoActions } from '../../state/ducks/metaGroups';
import {
  useMemberGroupChangePending,
  useStateOf03GroupMembers,
} from '../../state/selectors/groups';
import { useSelectedIsGroupV2 } from '../../state/selectors/selectedConversation';
import { SessionSpinner } from '../loading';
import { SessionToggle } from '../basic/SessionToggle';

type Props = {
  conversationId: string;
};

const StyledMemberList = styled.div`
  max-height: 240px;
`;

/**
 * Admins are always put first in the list of group members.
 * Also, admins have a little crown on their avatar.
 */
const MemberList = (props: {
  convoId: string;
  selectedMembers: Array<string>;
  onSelect: (m: string) => void;
  onUnselect: (m: string) => void;
}) => {
  const { onSelect, convoId, onUnselect, selectedMembers } = props;
  const weAreAdmin = useWeAreAdmin(convoId);
  const isV2Group = useSelectedIsGroupV2();

  const groupAdmins = useGroupAdmins(convoId);
  const groupMembers = useSortedGroupMembers(convoId);
  const groupMembers03Group = useStateOf03GroupMembers(convoId);

  const sortedMembersNon03 = useMemo(
    () => [...groupMembers].sort(m => (groupAdmins?.includes(m) ? -1 : 0)),
    [groupMembers, groupAdmins]
  );

  const sortedMembers = isV2Group ? groupMembers03Group.map(m => m.pubkeyHex) : sortedMembersNon03;

  return (
    <>
      {sortedMembers.map(member => {
        const isSelected = (weAreAdmin && selectedMembers.includes(member)) || false;
        const memberIsAdmin = groupAdmins?.includes(member);
        // we want to hide the toggle for admins are they are not selectable
        const showRadioButton = !memberIsAdmin && weAreAdmin;

        return (
          <MemberListItem
            key={`classic-member-list-${member}`}
            pubkey={member}
            isSelected={isSelected}
            onSelect={onSelect}
            onUnselect={onUnselect}
            isAdmin={memberIsAdmin}
            hideRadioButton={!showRadioButton}
            disableBg={true}
            displayGroupStatus={isV2Group}
            groupPk={convoId}
            maxNameWidth="100%"
          />
        );
      })}
    </>
  );
};

async function onSubmit(convoId: string, membersAfterUpdate: Array<string>) {
  const convoFound = ConvoHub.use().get(convoId);
  if (!convoFound || !convoFound.isGroup()) {
    throw new Error('Invalid convo for updateGroupMembersDialog');
  }
  if (!convoFound.weAreAdminUnblinded()) {
    window.log.warn('Skipping update of members, we are not the admin');
    return;
  }
  const ourPK = UserUtils.getOurPubKeyStrFromCache();

  const allMembersAfterUpdate = _.uniq(_.concat(membersAfterUpdate, [ourPK]));

  // membersAfterUpdate won't include the zombies. We are the admin and we want to remove them not matter what

  // We need to NOT trigger an group update if the list of member is the same.
  // We need to merge all members, including zombies for this call.
  // We consider that the admin ALWAYS wants to remove zombies (actually they should be removed
  // automatically by him when the LEFT message is received)

  const existingMembers = convoFound.getGroupMembers() || [];
  const existingZombies = convoFound.getGroupZombies() || [];

  const allExistingMembersWithZombies = _.uniq(existingMembers.concat(existingZombies));

  const notPresentInOld = allMembersAfterUpdate.filter(
    m => !allExistingMembersWithZombies.includes(m)
  );

  // be sure to include zombies in here
  const membersToRemove = allExistingMembersWithZombies.filter(
    m => !allMembersAfterUpdate.includes(m)
  );

  // do the xor between the two. if the length is 0, it means the before and the after is the same.
  const xor = _.xor(membersToRemove, notPresentInOld);
  if (xor.length === 0) {
    window.log.info('skipping group update: no detected changes in group member list');

    return;
  }

  // If any extra devices of removed exist in newMembers, ensure that you filter them
  // Note: I think this is useless
  const filteredMembers = allMembersAfterUpdate.filter(
    memberAfterUpdate => !_.includes(membersToRemove, memberAfterUpdate)
  );

  void ClosedGroup.initiateClosedGroupUpdate(
    convoId,
    convoFound.getRealSessionUsername() || 'Unknown',
    filteredMembers
  );
}

export const UpdateGroupMembersDialog = (props: Props) => {
  const { conversationId } = props;
  const isPrivate = useIsPrivate(conversationId);
  const isPublic = useIsPublic(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);
  const existingMembers = useSortedGroupMembers(conversationId) || [];
  const groupAdmins = useGroupAdmins(conversationId);
  const isProcessingUIChange = useMemberGroupChangePending();
  const [alsoRemoveMessages, setAlsoRemoveMessages] = useState(false);

  const { addTo, removeFrom, uniqueValues: membersToRemove } = useSet<string>([]);

  const dispatch = useDispatch();

  if (isPrivate || isPublic) {
    throw new Error('UpdateGroupMembersDialog invalid convoProps');
  }

  const closeDialog = () => {
    dispatch(updateGroupMembersModal(null));
  };

  const onClickOK = async () => {
    if (PubKey.is03Pubkey(conversationId)) {
      const groupv2Action = groupInfoActions.currentDeviceGroupMembersChange({
        groupPk: conversationId,
        addMembersWithHistory: [],
        addMembersWithoutHistory: [],
        removeMembers: membersToRemove as Array<PubkeyType>,
        alsoRemoveMessages,
      });
      dispatch(groupv2Action as any);

      return; // keeping the dialog open until the async thunk is done
    }

    await onSubmit(
      conversationId,
      difference(existingMembers, membersToRemove) as Array<PubkeyType>
    );

    closeDialog();
  };

  useKey((event: KeyboardEvent) => {
    return event.key === 'Esc' || event.key === 'Escape';
  }, closeDialog);

  const onSelect = (member: string) => {
    if (!weAreAdmin) {
      window?.log?.warn('Only group admin can select!');
      return;
    }

    if (groupAdmins?.includes(member)) {
      ToastUtils.pushCannotRemoveGroupAdmin();
      window?.log?.warn(`User ${member} cannot be selected as they are an admin.`);

      return;
    }

    addTo(member);
  };

  const onUnselect = (member: string) => {
    if (!weAreAdmin) {
      window?.log?.warn('Only group admin can unselect members!');
      return;
    }

    removeFrom(member);
  };

  const showNoMembersMessage = existingMembers.length === 0;

  return (
    <SessionWrapperModal title={window.i18n('groupMembers')} onClose={closeDialog}>
      {hasClosedGroupV2QAButtons() && weAreAdmin && PubKey.is03Pubkey(conversationId) ? (
        <>
          Also remove messages:
          <SessionToggle
            active={alsoRemoveMessages}
            onClick={() => {
              setAlsoRemoveMessages(!alsoRemoveMessages);
            }}
          />
        </>
      ) : null}
      <StyledMemberList className="contact-selection-list">
        <MemberList
          convoId={conversationId}
          onSelect={onSelect}
          onUnselect={onUnselect}
          selectedMembers={membersToRemove}
        />
      </StyledMemberList>
      {showNoMembersMessage && <p>{window.i18n('groupMembersNone')}</p>}

      <SpacerLG />
      <SessionSpinner loading={isProcessingUIChange} />
      <SpacerLG />

      <div className="session-modal__button-group">
        {weAreAdmin && (
          <SessionButton
            text={window.i18n('remove')}
            onClick={onClickOK}
            buttonType={SessionButtonType.Simple}
            buttonColor={SessionButtonColor.Danger}
            disabled={isProcessingUIChange}
            dataTestId="session-confirm-ok-button"
          />
        )}
        <SessionButton
          text={window.i18n('cancel')}
          buttonType={SessionButtonType.Simple}
          onClick={closeDialog}
          disabled={isProcessingUIChange}
          dataTestId="session-confirm-cancel-button"
        />
      </div>
    </SessionWrapperModal>
  );
};
