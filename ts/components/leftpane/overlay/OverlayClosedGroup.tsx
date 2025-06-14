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
import { clearSearch } from '../../../state/ducks/search';
import { resetLeftOverlayMode } from '../../../state/ducks/section';
import { useContactsToInviteToGroup } from '../../../state/selectors/conversations';
import { useIsCreatingGroupFromUIPending } from '../../../state/selectors/groups';
import {
  getSearchResultsContactOnly,
  getSearchTerm,
  useIsSearching,
} from '../../../state/selectors/search';
import { useOurPkStr } from '../../../state/selectors/user';
import { GroupInviteRequiredVersionBanner } from '../../NoticeBanner';
import { SessionSearchInput } from '../../SessionSearchInput';
import { Flex } from '../../basic/Flex';
import { Localizer } from '../../basic/Localizer';
import { SessionToggle } from '../../basic/SessionToggle';
import { SpacerLG, SpacerMD } from '../../basic/Text';
import { SessionInput } from '../../inputs';
import { SessionSpinner } from '../../loading';
import { StyledLeftPaneOverlay } from './OverlayMessage';
import { hasClosedGroupV2QAButtons } from '../../../shared/env_vars';
import type { StateType } from '../../../state/reducer';
import { PubKey } from '../../../session/types';

const StyledMemberListNoContacts = styled.div`
  text-align: center;
  align-self: center;
  padding: 20px;
`;

const StyledNoResults = styled.div`
  width: 100%;
  min-height: 40px;
  max-height: 400px;
  padding: var(--margins-xl) var(--margins-sm);
  text-align: center;
`;

const StyledGroupMemberListContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
`;

const NoContacts = () => {
  return (
    <StyledMemberListNoContacts>
      <Localizer token="contactNone" />
    </StyledMemberListNoContacts>
  );
};

// duplicated from the legacy one below because this one is a lot more tightly linked with redux async thunks logic
export const OverlayClosedGroupV2 = () => {
  const dispatch = useDispatch();
  const us = useOurPkStr();
  const privateContactsPubkeys = useContactsToInviteToGroup();
  const isCreatingGroup = useIsCreatingGroupFromUIPending();
  const groupName = useSelector((state: StateType) => state.groups.creationGroupName) || '';
  const [inviteAsAdmin, setInviteAsAdmin] = useBoolean(false);
  const [groupNameError, setGroupNameError] = useState<string | undefined>();
  const isSearch = useIsSearching();
  const searchTerm = useSelector(getSearchTerm);
  const searchResultContactsOnly = useSelector(getSearchResultsContactOnly);

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
    dispatch(clearSearch());
    dispatch(resetLeftOverlayMode());
  }

  function onValueChanged(value: string) {
    dispatch(groupInfoActions.updateGroupCreationName({ name: value }));
  }

  async function onEnterPressed() {
    setGroupNameError(undefined);
    if (isCreatingGroup) {
      window?.log?.warn('Closed group creation already in progress');
      return;
    }

    // Validate groupName and groupMembers length
    if (groupName.length === 0) {
      ToastUtils.pushToastError('invalidGroupName', window.i18n('groupNameEnterPlease'));
      return;
    }
    if (groupName.length > LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH) {
      setGroupNameError(window.i18n('groupNameEnterShorter'));
      return;
    }

    // >= because we add ourself as a member AFTER this. so a 10 member group is already invalid as it will be 11 with us
    // the same is valid with groups count < 1

    if (selectedMemberIds.length < 1) {
      ToastUtils.pushToastError('pickClosedGroupMember', window.i18n('groupCreateErrorNoMembers'));
      return;
    }
    if (selectedMemberIds.length >= VALIDATION.CLOSED_GROUP_SIZE_LIMIT) {
      ToastUtils.pushToastError('closedGroupMaxSize', window.i18n('groupAddMemberMaximum'));
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
  const contactsToRender = isSearch
    ? searchResultContactsOnly.filter(m => PubKey.is05Pubkey(m))
    : privateContactsPubkeys;

  const noContactsForClosedGroup = isEmpty(searchTerm) && contactsToRender.length === 0;

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
        <SessionInput
          autoFocus={true}
          type="text"
          placeholder={window.i18n('groupNameEnter')}
          value={groupName}
          onValueChanged={onValueChanged}
          onEnterPressed={onEnterPressed}
          error={groupNameError}
          loading={isCreatingGroup}
          maxLength={LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH}
          textSize="md"
          centerText={true}
          monospaced={true}
          isTextArea={true}
          inputDataTestId="new-closed-group-name"
          editable={!noContactsForClosedGroup && !isCreatingGroup}
        />
        <SpacerMD />
        {/* TODO: localize those strings once out releasing those buttons for real Remove after QA */}
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

      <SessionSearchInput />
      {!noContactsForClosedGroup && <GroupInviteRequiredVersionBanner />}

      <StyledGroupMemberListContainer>
        {noContactsForClosedGroup ? (
          <NoContacts />
        ) : searchTerm && !contactsToRender.length ? (
          <StyledNoResults>
            <Localizer token="searchMatchesNoneSpecific" args={{ query: searchTerm }} />
          </StyledNoResults>
        ) : (
          contactsToRender.map((memberPubkey: string) => {
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
          text={window.i18n('create')}
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
