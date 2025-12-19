import { useState } from 'react';
import { useSelector } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';
import { List, AutoSizer, ListRowProps } from 'react-virtualized';

import { concat, isEmpty } from 'lodash';
import useBoolean from 'react-use/lib/useBoolean';
import type { PubkeyType } from 'libsession_util_nodejs';
import { getAppDispatch } from '../../../state/dispatch';
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
import type { StateType } from '../../../state/reducer';
import { PubKey } from '../../../session/types';
import { searchActions } from '../../../state/ducks/search';
import { useContactsToInviteTo } from '../../../hooks/useContactsToInviteToGroup';
import { NoContacts, NoResultsForSearch } from '../../search/NoResults';
import { SimpleSessionTextarea } from '../../inputs/SimpleSessionTextarea';
import { tr, tStripped } from '../../../localization/localeTools';
import { getFeatureFlag } from '../../../state/ducks/types/releasedFeaturesReduxTypes';

const ROW_HEIGHT = 50;

const StyledGroupMemberListContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  overflow: hidden;
`;

function getSelectedMemberIds(state: StateType) {
  return state.groups.creationMembersSelected || [];
}

function useSelectedMemberIds() {
  return useSelector(getSelectedMemberIds);
}

function useGroupName() {
  const [groupName, setGroupName] = useState<string>('');
  return { groupName, setGroupName };
}

const useOurPkStrInternal = useOurPkStr;
const useIsCreatingGroupFromUIPendingInternal = useIsCreatingGroupFromUIPending;

function useContactsToInviteToInternal() {
  return useContactsToInviteTo('create-group');
}

function useGroupNameError() {
  const [groupNameError, setGroupNameError] = useState<string | undefined>();
  return { groupNameError, setGroupNameError };
}

export const OverlayClosedGroupV2 = () => {
  const dispatch = getAppDispatch();
  const us = useOurPkStrInternal();
  const { contactsToInvite, searchTerm } = useContactsToInviteToInternal();
  const isCreatingGroup = useIsCreatingGroupFromUIPendingInternal();
  const { groupName, setGroupName } = useGroupName();
  const [inviteAsAdmin, setInviteAsAdmin] = useBoolean(false);
  const { groupNameError, setGroupNameError } = useGroupNameError();

  const selectedMemberIds = useSelectedMemberIds();

  const addMemberToSelection = (member: PubkeyType) => {
    dispatch(groupInfoActions.addSelectedGroupMember({ memberToAdd: member }));
  };

  const removeMemberFromSelection = (member: PubkeyType) => {
    dispatch(groupInfoActions.removeSelectedGroupMember({ memberToRemove: member }));
  };

  function closeOverlay() {
    dispatch(searchActions.clearSearch());
    dispatch(sectionActions.resetLeftOverlayMode());
  }

  function onValueChanged(value: string) {
    setGroupName(value);
    dispatch(groupInfoActions.updateGroupCreationName({ name: value }));
  }

  function onEnterPressed() {
    setGroupNameError(undefined);
    if (isCreatingGroup) {
      window?.log?.warn('Closed group creation already in progress');
      return;
    }

    if (groupName.length === 0) {
      ToastUtils.pushToastError('invalidGroupName', tr('groupNameEnterPlease'));
      return;
    }
    if (groupName.length > LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH) {
      setGroupNameError(tr('groupNameEnterShorter'));
      return;
    }

    if (selectedMemberIds.length < 1) {
      ToastUtils.pushToastError('pickClosedGroupMember', tr('groupCreateErrorNoMembers'));
      return;
    }
    if (selectedMemberIds.length >= VALIDATION.CLOSED_GROUP_SIZE_LIMIT) {
      ToastUtils.pushToastError('closedGroupMaxSize', tStripped('groupAddMemberMaximum'));
      return;
    }

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

  const rowRenderer = ({ index, key, style }: ListRowProps) => {
    const memberPubkey = contactsToInvite[index];

    if (!PubKey.is05Pubkey(memberPubkey)) {
      throw new Error('Invalid member rendered in member list');
    }

    return (
      <div key={key} style={style}>
        <MemberListItem
          pubkey={memberPubkey}
          isSelected={selectedMemberIds.includes(memberPubkey)}
          onSelect={addMemberToSelection}
          onUnselect={removeMemberFromSelection}
          withBorder={false}
          disabled={isCreatingGroup}
        />
      </div>
    );
  };

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
        $padding={'var(--margins-md)'}
      >
        <SimpleSessionTextarea
          // not monospaced. This is a plain text input for a group name
          autoFocus={true}
          placeholder={tr('groupNameEnter')}
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
        {getFeatureFlag('useClosedGroupV2QAButtons') && (
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

        <SessionSpinner $loading={isCreatingGroup} />
        <SpacerLG />
      </Flex>

      <SessionSearchInput searchType="create-group" />

      <StyledGroupMemberListContainer>
        {noContactsForClosedGroup ? (
          <NoContacts />
        ) : searchTerm && !contactsToInvite.length ? (
          <NoResultsForSearch searchTerm={searchTerm} />
        ) : (
          <AutoSizer>
            {({ width, height }) => (
              <List
                width={width}
                height={height}
                rowCount={contactsToInvite.length}
                rowHeight={ROW_HEIGHT}
                rowRenderer={rowRenderer}
                // NOTE: These are passed as props to trigger a re-render when they change
                selectedMemberIds={selectedMemberIds}
                isCreatingGroup={isCreatingGroup}
              />
            )}
          </AutoSizer>
        )}
      </StyledGroupMemberListContainer>

      <SpacerLG style={{ flexShrink: 0 }} />
      <Flex $container={true} width={'100%'} $flexDirection="column" $padding={'var(--margins-md)'}>
        <SessionButton
          text={tr('create')}
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
