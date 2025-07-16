import { useState } from 'react';
import { useDispatch } from 'react-redux';
import useUpdate from 'react-use/lib/useUpdate';
import styled from 'styled-components';
import { useSet } from '../../hooks/useSet';
import { updateBlockOrUnblockModal } from '../../state/ducks/modalDialog';
import { BlockedNumberController } from '../../util';
import { MemberListItem } from '../MemberListItem';
import { Localizer } from '../basic/Localizer';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import { SpacerLG, SpacerSM } from '../basic/Text';
import { SessionSettingsItemWrapper, SettingsTitleAndDescription } from './SessionSettingListItem';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

const BlockedEntriesContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
`;

const BlockedEntriesRoundedContainer = styled.div`
  background: var(--background-secondary-color);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: var(--margins-lg);
  margin: 0 var(--margins-lg);
`;

const BlockedContactListTitle = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const BlockedContactListTitleButtons = styled.div`
  display: flex;
  align-items: center;
  min-height: 34px; // height of the unblock button
`;

export const StyledBlockedSettingItem = styled.div<{ clickable: boolean; expanded: boolean }>`
  font-size: var(--font-size-md);
  cursor: ${props => (props.clickable ? 'pointer' : 'unset')};
  ${props => props.expanded && 'padding-bottom: var(--margins-lg);'}
`;

const BlockedEntries = (props: {
  blockedNumbers: Array<string>;
  selectedIds: Array<string>;
  addToSelected: (id: string) => void;
  removeFromSelected: (id: string) => void;
}) => {
  const { addToSelected, blockedNumbers, removeFromSelected, selectedIds } = props;
  return (
    <BlockedEntriesRoundedContainer>
      <BlockedEntriesContainer>
        {blockedNumbers.map(blockedEntry => {
          return (
            <MemberListItem
              key={`blocked-list-item-${blockedEntry}`}
              pubkey={blockedEntry}
              isSelected={selectedIds.includes(blockedEntry)}
              onSelect={addToSelected}
              onUnselect={removeFromSelected}
              disableBg={true}
              maxNameWidth="100%"
            />
          );
        })}
      </BlockedEntriesContainer>
    </BlockedEntriesRoundedContainer>
  );
};

const NoBlockedContacts = () => {
  return (
    <div>
      <Localizer token="blockBlockedNone" />
    </div>
  );
};

export const BlockedContactsList = () => {
  const dispatch = useDispatch();
  const [expanded, setExpanded] = useState(false);
  const {
    uniqueValues: selectedIds,
    addTo: addToSelected,
    removeFrom: removeFromSelected,
    empty: emptySelected,
  } = useSet<string>([]);

  const forceUpdate = useUpdate();

  const hasAtLeastOneSelected = Boolean(selectedIds.length);
  const blockedNumbers = BlockedNumberController.getBlockedNumbers();
  const noBlockedNumbers = !blockedNumbers.length;

  function toggleUnblockList() {
    if (blockedNumbers.length) {
      setExpanded(!expanded);
    }
  }

  async function unBlockThoseUsers() {
    if (selectedIds.length) {
      dispatch(
        updateBlockOrUnblockModal({
          action: 'unblock',
          pubkeys: selectedIds,
          onConfirmed: () => {
            // annoying, but until that BlockedList is in redux, we need to force a refresh of this component when a change is made.
            emptySelected();
            forceUpdate();
          },
        })
      );
    }
  }

  return (
    <SessionSettingsItemWrapper inline={false}>
      <StyledBlockedSettingItem
        clickable={!noBlockedNumbers}
        expanded={!noBlockedNumbers && expanded}
      >
        <BlockedContactListTitle onClick={toggleUnblockList}>
          <SettingsTitleAndDescription title={window.i18n('conversationsBlockedContacts')} />
          {noBlockedNumbers ? (
            <NoBlockedContacts />
          ) : (
            <BlockedContactListTitleButtons>
              {hasAtLeastOneSelected && expanded ? (
                <SessionButton
                  buttonColor={SessionButtonColor.Danger}
                  text={window.i18n('blockUnblock')}
                  onClick={unBlockThoseUsers}
                  dataTestId="unblock-button-settings-screen"
                />
              ) : null}
              <SpacerLG />
              <SessionLucideIconButton
                iconSize={'large'}
                unicode={
                  expanded ? LUCIDE_ICONS_UNICODE.CHEVRON_UP : LUCIDE_ICONS_UNICODE.CHEVRON_DOWN
                }
                onClick={toggleUnblockList}
                dataTestId="reveal-blocked-user-settings"
              />
            </BlockedContactListTitleButtons>
          )}
        </BlockedContactListTitle>
      </StyledBlockedSettingItem>
      {expanded && !noBlockedNumbers ? (
        <>
          <BlockedEntries
            blockedNumbers={blockedNumbers}
            selectedIds={selectedIds}
            addToSelected={addToSelected}
            removeFromSelected={removeFromSelected}
          />
          <SpacerSM />
        </>
      ) : null}
    </SessionSettingsItemWrapper>
  );
};
