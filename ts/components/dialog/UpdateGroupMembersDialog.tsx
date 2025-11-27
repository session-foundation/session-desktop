import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';

import { PubkeyType } from 'libsession_util_nodejs';
import { ToastUtils } from '../../session/utils';

import { updateGroupMembersModal } from '../../state/ducks/modalDialog';
import { MemberListItem } from '../MemberListItem';
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
import { tr } from '../../localization/localeTools';
import { SessionSearchInput } from '../SessionSearchInput';
import { NoGroupMembers } from '../search/NoResults';
import { useContactsToInviteTo } from '../../hooks/useContactsToInviteToGroup';
import { searchActions } from '../../state/ducks/search';
import { StyledContactListInModal } from '../list/StyledContactList';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
  WrapperModalWidth,
} from '../SessionWrapperModal';

type Props = {
  conversationId: string;
};

function useSortedListOfMembers(convoId: string) {
  const groupMembersLegacy = useSortedGroupMembers(convoId);
  const groupMembers03Group = useStateOf03GroupMembers(convoId);
  const isV2Group = useSelectedIsGroupV2();
  const groupAdmins = useGroupAdmins(convoId);

  const sortedMembersNon03 = useMemo(
    () => groupMembersLegacy.toSorted(m => (groupAdmins?.includes(m) ? -1 : 0)),
    [groupMembersLegacy, groupAdmins]
  );
  const sortedMembers = isV2Group ? groupMembers03Group.map(m => m.pubkeyHex) : sortedMembersNon03;

  return sortedMembers;
}

const useFilteredSortedListOfMembers = (convoId: string) => {
  const sortedMembers = useSortedListOfMembers(convoId);
  const { contactsToInvite: globalSearchResults, searchTerm } =
    useContactsToInviteTo('manage-group-members');

  return useMemo(
    () =>
      !searchTerm || globalSearchResults === undefined
        ? sortedMembers
        : sortedMembers.filter(m => globalSearchResults.includes(m)),
    [sortedMembers, globalSearchResults, searchTerm]
  );
};

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
  const sortedMembers = useFilteredSortedListOfMembers(convoId);

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
            conversationId={convoId}
          />
        );
      })}
    </>
  );
};

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
    dispatch(searchActions.clearSearch());
  };

  const onClickOK = async () => {
    if (!PubKey.is03Pubkey(conversationId)) {
      throw new Error('Only 03 groups are supported here');
    }
    const toRemoveAndCurrentMembers = membersToRemove.filter(m =>
      existingMembers.includes(m as PubkeyType)
    );

    const groupv2Action = groupInfoActions.currentDeviceGroupMembersChange({
      groupPk: conversationId,
      addMembersWithHistory: [],
      addMembersWithoutHistory: [],
      removeMembers: toRemoveAndCurrentMembers as Array<PubkeyType>,
      alsoRemoveMessages,
    });
    dispatch(groupv2Action as any);

    // keeping the dialog open until the async thunk is done
  };

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

  return (
    <SessionWrapperModal
      modalId="groupMembersModal"
      headerChildren={
        <ModalBasicHeader title={tr(weAreAdmin ? 'manageMembers' : 'groupMembers')} />
      }
      onClose={closeDialog}
      $contentMinWidth={WrapperModalWidth.wide}
      $contentMaxWidth={WrapperModalWidth.wide}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Simple}>
          {weAreAdmin && (
            <SessionButton
              text={tr('remove')}
              onClick={onClickOK}
              buttonType={SessionButtonType.Simple}
              buttonColor={SessionButtonColor.Danger}
              disabled={isProcessingUIChange || !membersToRemove.length}
              dataTestId="session-confirm-ok-button"
            />
          )}
          <SessionButton
            text={tr('cancel')}
            buttonType={SessionButtonType.Simple}
            onClick={closeDialog}
            disabled={isProcessingUIChange}
            dataTestId="session-confirm-cancel-button"
          />
        </ModalActionsContainer>
      }
    >
      {hasClosedGroupV2QAButtons() && weAreAdmin && PubKey.is03Pubkey(conversationId) ? (
        <>
          <span
            style={{
              display: 'flex',
              justifyContent: 'space-evenly',
              alignItems: 'center',
              width: '400px',
            }}
          >
            Also remove messages:
            <SessionToggle
              active={alsoRemoveMessages}
              onClick={() => {
                setAlsoRemoveMessages(!alsoRemoveMessages);
              }}
            />
          </span>
        </>
      ) : null}
      <SessionSearchInput searchType="manage-group-members" />
      <StyledContactListInModal>
        {!existingMembers.length ? (
          <NoGroupMembers />
        ) : (
          <MemberList
            convoId={conversationId}
            onSelect={onSelect}
            onUnselect={onUnselect}
            selectedMembers={membersToRemove}
          />
        )}
      </StyledContactListInModal>

      <SpacerLG />
      <SessionSpinner loading={isProcessingUIChange} />
      <SpacerLG />
    </SessionWrapperModal>
  );
};
