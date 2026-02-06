import type { PubkeyType } from 'libsession_util_nodejs';
import { useCallback } from 'react';
import styled from 'styled-components';
import { getAppDispatch } from '../../../state/dispatch';

import {
  use05GroupMembers,
  useConversationUsernameWithFallback,
  useIsIncomingRequest,
  useIsOutgoingRequest,
} from '../../../hooks/useParamSelector';
import {
  useIsMessageSelectionMode,
  useSelectedConversationKey,
  useSelectedIsBlocked,
  useSelectedIsLegacyGroup,
  useSelectedWeAreAdmin,
} from '../../../state/selectors/selectedConversation';
import { Flex } from '../../basic/Flex';
import { AvatarHeader, CallButton } from './ConversationHeaderItems';
import { SelectionOverlay } from './ConversationHeaderSelectionOverlay';
import { ConversationHeaderTitle } from './ConversationHeaderTitle';
import { tr } from '../../../localization/localeTools';
import { updateConfirmModal } from '../../../state/ducks/modalDialog';
import { SessionButtonColor, SessionButton, SessionButtonType } from '../../basic/SessionButton';
import { ConvoHub } from '../../../session/conversations';
import { ConversationTypeEnum } from '../../../models/types';
import { Constants } from '../../../session';
import { useKeyboardShortcut } from '../../../hooks/useKeyboardShortcut';
import { KbdShortcut } from '../../../util/keyboardShortcuts';
import { useToggleConversationSettingsFor } from '../../menuAndSettingsHooks/useToggleConversationSettingsFor';
import { useOverlayChooseAction } from '../../leftpane/overlay/choose-action/OverlayChooseAction';

const StyledConversationHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  height: var(--main-view-header-height);
  position: relative;
  padding: 0px var(--margins-lg) 0px var(--margins-sm);
  background: var(--background-primary-color);
`;

export const ConversationHeaderWithDetails = () => {
  const isSelectionMode = useIsMessageSelectionMode();
  const selectedConvoKey = useSelectedConversationKey();
  const isOutgoingRequest = useIsOutgoingRequest(selectedConvoKey);
  const isIncomingRequest = useIsIncomingRequest(selectedConvoKey);
  const isBlocked = useSelectedIsBlocked();

  const toggleConvoSettingsCb = useToggleConversationSettingsFor(selectedConvoKey);

  useKeyboardShortcut({
    shortcut: KbdShortcut.conversationSettingsModal,
    handler: toggleConvoSettingsCb,
  });

  if (!selectedConvoKey) {
    return null;
  }

  return (
    <StyledConversationHeader>
      <Flex
        $container={true}
        $justifyContent={'flex-end'}
        $alignItems="center"
        width="100%"
        $flexGrow={1}
      >
        <ConversationHeaderTitle
          showSubtitle={!isOutgoingRequest && !isIncomingRequest && !isBlocked}
        />

        {!isOutgoingRequest && !isSelectionMode && (
          <Flex
            $container={true}
            $flexDirection="row"
            $alignItems="center"
            $flexGrow={0}
            $flexShrink={0}
          >
            <RecreateGroupButton />
            <CallButton />
            <AvatarHeader onAvatarClick={toggleConvoSettingsCb} pubkey={selectedConvoKey} />
          </Flex>
        )}
      </Flex>

      {isSelectionMode && <SelectionOverlay />}
    </StyledConversationHeader>
  );
};

const RecreateGroupContainer = styled.div`
  display: flex;
  justify-content: center;
  align-self: center;
  width: 100%;

  .session-button {
    padding-inline: var(--margins-3xl);
  }
`;

function useShowRecreateModal() {
  const dispatch = getAppDispatch();
  const { openCreateGroup } = useOverlayChooseAction();

  return useCallback(
    (name: string, members: Array<PubkeyType>) => {
      dispatch(
        updateConfirmModal({
          title: tr('recreateGroup'),
          i18nMessage: { token: 'legacyGroupChatHistory' },
          okText: tr('theContinue'),
          cancelText: tr('cancel'),
          okTheme: SessionButtonColor.Danger,
          onClickOk: () => {
            openCreateGroup(name, members);
          },
          onClickClose: () => {
            dispatch(updateConfirmModal(null));
          },
        })
      );
    },
    [dispatch, openCreateGroup]
  );
}

// NOTE: [react-compiler] this has to live here for the hook to be identified as static
function useGroupDetailsInternal() {
  const isLegacyGroup = useSelectedIsLegacyGroup();
  const selectedConvo = useSelectedConversationKey();
  const name = useConversationUsernameWithFallback(true, selectedConvo);
  const members = use05GroupMembers(selectedConvo);
  const weAreAdmin = useSelectedWeAreAdmin();

  return {
    isLegacyGroup,
    name,
    members,
    weAreAdmin,
  };
}

async function ensureMemberConvosExist(members: Array<string>) {
  for (let index = 0; index < members.length; index++) {
    const m = members[index];
    /* eslint-disable no-await-in-loop */
    const memberConvo = await ConvoHub.use().getOrCreateAndWait(m, ConversationTypeEnum.PRIVATE);
    if (!memberConvo.get('active_at')) {
      memberConvo.setActiveAt(Constants.CONVERSATION.LAST_JOINED_FALLBACK_TIMESTAMP);
      await memberConvo.commit();
    }
  }
}

function RecreateGroupButton() {
  const { isLegacyGroup, name, members, weAreAdmin } = useGroupDetailsInternal();

  const showRecreateGroupModal = useShowRecreateModal();

  if (!isLegacyGroup || !weAreAdmin) {
    return null;
  }

  return (
    <RecreateGroupContainer>
      <SessionButton
        buttonType={SessionButtonType.Outline}
        margin="var(--margins-sm)"
        onClick={async () => {
          try {
            await ensureMemberConvosExist(members);
          } catch (e) {
            window.log.warn('recreate group: failed to recreate a member convo', e.message);
          }
          showRecreateGroupModal(name || tr('groupUnknown'), members);
        }}
      >
        {tr('recreateGroup')}
      </SessionButton>
    </RecreateGroupContainer>
  );
}
