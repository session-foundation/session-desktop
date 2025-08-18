import { useState } from 'react';
import useUpdate from 'react-use/lib/useUpdate';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';

import {
  updateBlockOrUnblockModal,
  type UserSettingsModalState,
} from '../../../../state/ducks/modalDialog';
import { PanelButtonGroup } from '../../../buttons/panel/PanelButton';
import {
  ModalBasicHeader,
  SessionWrapperModal,
  WrapperModalWidth,
} from '../../../SessionWrapperModal';
import { ModalBackButton } from '../../shared/ModalBackButton';
import {
  useUserSettingsBackAction,
  useUserSettingsCloseAction,
  useUserSettingsTitle,
} from './userSettingsHooks';
import { SpacerLG } from '../../../basic/Text';
import { SessionButton, SessionButtonColor } from '../../../basic/SessionButton';
import { tr } from '../../../../localization/localeTools';
import { MemberListItem } from '../../../MemberListItem';
import { Localizer } from '../../../basic/Localizer';
import { BlockedNumberController } from '../../../../util';

const StyledButtonContainer = styled.div`
  display: flex;
  width: min-content;
  flex-direction: column;
  padding-inline-start: var(--margins-lg);
`;

const StyledNoBlockedContactsContainer = styled.div`
  justify-self: center;
  // not pretty, but the only other way I found is to change the style of PanelButtonContainer itself, which I'd like to avoid
  height: var(--panel-button-container-min-height);
  align-content: center;
`;

const NoBlockedContacts = () => {
  return (
    <StyledNoBlockedContactsContainer>
      <Localizer token="blockBlockedNone" />
    </StyledNoBlockedContactsContainer>
  );
};

export function BlockedContactsSettingsPage(modalState: UserSettingsModalState) {
  const forceUpdate = useUpdate();
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);
  const title = useUserSettingsTitle(modalState);
  const dispatch = useDispatch();
  const [selectedIds, setSelectedIds] = useState<Array<string>>([]);

  async function unBlockThoseUsers() {
    if (selectedIds.length) {
      dispatch(
        updateBlockOrUnblockModal({
          action: 'unblock',
          pubkeys: selectedIds,
          onConfirmed: () => {
            // annoying, but until that BlockedList is in redux, we need to force a refresh of this component when a change is made.
            setSelectedIds([]);
            forceUpdate();
          },
        })
      );
    }
  }

  const blocked = BlockedNumberController.getBlockedNumbers();
  const hasBlocked = blocked.length > 0;
  const canUnblock = selectedIds.length > 0;

  return (
    <SessionWrapperModal
      headerChildren={
        <ModalBasicHeader
          title={title}
          bigHeader={true}
          showExitIcon={true}
          extraLeftButton={backAction ? <ModalBackButton onClick={backAction} /> : undefined}
        />
      }
      onClose={closeAction || undefined}
      shouldOverflow={true}
      allowOutsideClick={false}
      $contentMinWidth={WrapperModalWidth.normal}
    >
      <PanelButtonGroup>
        {!blocked.length ? (
          <NoBlockedContacts />
        ) : (
          blocked.map(blockedEntry => {
            return (
              <MemberListItem
                key={`blocked-list-item-${blockedEntry}`}
                pubkey={blockedEntry}
                isSelected={selectedIds.includes(blockedEntry)}
                onSelect={() => {
                  setSelectedIds([...selectedIds, blockedEntry]);
                }}
                onUnselect={() => {
                  setSelectedIds(selectedIds.filter(id => id !== blockedEntry));
                }}
                disableBg={true}
              />
            );
          })
        )}
      </PanelButtonGroup>
      {hasBlocked ? (
        <StyledButtonContainer>
          <SpacerLG />
          <SessionButton
            text={tr('blockUnblock')}
            onClick={unBlockThoseUsers}
            buttonColor={SessionButtonColor.Danger}
            dataTestId="unblock-button-settings-screen"
            disabled={!canUnblock}
          />
        </StyledButtonContainer>
      ) : null}
    </SessionWrapperModal>
  );
}
