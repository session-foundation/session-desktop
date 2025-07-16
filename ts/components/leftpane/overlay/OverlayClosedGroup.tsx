import { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { concat, isEmpty } from 'lodash';
import useBoolean from 'react-use/lib/useBoolean';
import type { PubkeyType } from 'libsession_util_nodejs';
import { MemberListItem } from '../../MemberListItem';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';

import { VALIDATION } from '../../../session/constants';
import { ToastUtils } from '../../../session/utils';
import LIBSESSION_CONSTANTS from '../../../session/utils/libsession/libsession_constants';
import { groupInfoActions } from '../../../state/ducks/metaGroups';
import { sectionActions } from '../../../state/ducks/section';
import { useIsCreatingGroupFromUIPending } from '../../../state/selectors/groups';
import { useOurPkStr } from '../../../state/selectors/user';
import { SessionSearchInput } from '../../SessionSearchInput';
import { Flex } from '../../basic/Flex';
import { SessionToggle } from '../../basic/SessionToggle';
import { SpacerLG, SpacerMD } from '../../basic/Text';
import { SessionSpinner } from '../../loading';
import { StyledLeftPaneOverlay } from './OverlayMessage';
import { hasClosedGroupV2QAButtons } from '../../../shared/env_vars';
import type { StateType } from '../../../state/reducer';
import { PubKey } from '../../../session/types';
import { searchActions } from '../../../state/ducks/search';
import { useContactsToInviteTo } from '../../../hooks/useContactsToInviteToGroup';
import { NoContacts, NoResultsForSearch } from '../../search/NoResults';
import { SimpleSessionTextarea } from '../../inputs/SessionInput';
import { localize } from '../../../localization/localeTools';

const StyledGroupMemberListContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
`;

export const OverlayClosedGroupV2 = () => {
  const dispatch = useDispatch();
  const us = useOurPkStr();
  const { contactsToInvite, searchTerm } = useContactsToInviteTo('create-group');
  const isCreatingGroup = useIsCreatingGroupFromUIPending();
  const groupName = useSelector((state: StateType) => state.groups.creationGroupName) || '';
  const [inviteAsAdmin, setInviteAsAdmin] = useBoolean(false);
  const [groupNameError, setGroupNameError] = useState<string | undefined>();

  const selectedMemberIds = useSelector(
    (state: StateType) => state.groups.creationMembersSelected || []
  );

  function addMemberToSelection(member: PubkeyType) {
    dispatch(groupInfoActions.addSelectedGroupMember({ memberToAdd: member }));
  }

  function removeMemberFromSelection(member: PubkeyType) {
    dispatch(groupInfoActions.removeSelectedGroupMember({ memberToRemove: member }));
  }

  function closeOverlay() {
    dispatch(searchActions.clearSearch());
    dispatch(sectionActions.resetLeftOverlayMode());
  }

  function onValueChanged(value: string) {
    dispatch(groupInfoActions.updateGroupCreationName({ name: value }));
  }

  function onEnterPressed() {
    setGroupNameError(undefined);
    if (isCreatingGroup) {
      window?.log?.warn('Closed group creation already in progress');
      return;
    }

    // Validate groupName and groupMembers length
    if (groupName.length === 0) {
      ToastUtils.pushToastError('invalidGroupName', localize('groupNameEnterPlease').toString());
      return;
    }
    if (groupName.length > LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH) {
      setGroupNameError(localize('groupNameEnterShorter').toString());
      return;
    }

    // >= because we add ourself as a member AFTER this. so a 10 member group is already invalid as it will be 11 with us
    // the same is valid with groups count < 1

    if (selectedMemberIds.length < 1) {
      ToastUtils.pushToastError(
        'pickClosedGroupMember',
        localize('groupCreateErrorNoMembers').toString()
      );
      return;
    }
    if (selectedMemberIds.length >= VALIDATION.CLOSED_GROUP_SIZE_LIMIT) {
      ToastUtils.pushToastError('closedGroupMaxSize', localize('groupAddMemberMaximum').toString());
      return;
    }
    // trigger the add through redux.
    dispatch(
      groupInfoActions.initNewGroupInWrapper({
        members: concat(selectedMemberIds, [us]),
        groupName,
        us,
        inviteAsAdmin,
      }) as any
    );
  }

  useKey('Escape', closeOverlay);

  const noContactsForClosedGroup = isEmpty(searchTerm) && contactsToInvite.length === 0;

  const disableCreateButton = isCreatingGroup || (!selectedMemberIds.length && !groupName.length);

  return (
    <StyledLeftPaneOverlay
      $container={true}
      $flexDirection={'column'}
      $flexGrow={1}
      $alignItems={'center'}
    >
      <Flex
        $container={true}
        width={'100%'}
        $flexDirection="column"
        $alignItems="center"
        padding={'var(--margins-md)'}
      >
        <SimpleSessionTextarea
          // not monospaced. This is a plain text input for a group name
          autoFocus={true}
          placeholder={localize('groupNameEnter').toString()}
          value={groupName}
          onValueChanged={onValueChanged}
          singleLine={true}
          onEnterPressed={onEnterPressed}
          providedError={groupNameError}
          disabled={isCreatingGroup || noContactsForClosedGroup}
          maxLength={LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH}
          textSize="md"
          inputDataTestId="new-closed-group-name"
          errorDataTestId="error-message"
        />
        <SpacerMD />
        {hasClosedGroupV2QAButtons() && (
          <>
            <span
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
              }}
            >
              Invite as admin?{'  '}
              <SessionToggle
                active={inviteAsAdmin}
                onClick={() => {
                  setInviteAsAdmin(!inviteAsAdmin);
                }}
              />
            </span>
          </>
        )}

        <SessionSpinner loading={isCreatingGroup} />
        <SpacerLG />
      </Flex>

      <SessionSearchInput searchType="create-group" />

      <StyledGroupMemberListContainer>
        {noContactsForClosedGroup ? (
          <NoContacts />
        ) : searchTerm && !contactsToInvite.length ? (
          <NoResultsForSearch searchTerm={searchTerm} />
        ) : (
          contactsToInvite.map((memberPubkey: string) => {
            if (!PubKey.is05Pubkey(memberPubkey)) {
              throw new Error('Invalid member rendered in member list');
            }

            return (
              <MemberListItem
                key={`member-list-${memberPubkey}`}
                pubkey={memberPubkey}
                isSelected={selectedMemberIds.includes(memberPubkey)}
                onSelect={addMemberToSelection}
                onUnselect={removeMemberFromSelection}
                withBorder={false}
                disabled={isCreatingGroup}
                maxNameWidth="100%"
              />
            );
          })
        )}
      </StyledGroupMemberListContainer>

      <SpacerLG style={{ flexShrink: 0 }} />
      <Flex $container={true} width={'100%'} $flexDirection="column" padding={'var(--margins-md)'}>
        <SessionButton
          text={localize('create').toString()}
          disabled={disableCreateButton}
          onClick={onEnterPressed}
          dataTestId="create-group-button"
          buttonColor={SessionButtonColor.PrimaryDark}
          margin="auto 0 0" // just to keep that button at the bottom of the overlay (even with an empty list)
        />
      </Flex>
      <SpacerLG />
    </StyledLeftPaneOverlay>
  );
};
