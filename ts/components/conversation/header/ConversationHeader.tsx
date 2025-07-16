import { useDispatch } from 'react-redux';

import type { PubkeyType } from 'libsession_util_nodejs';
import { useCallback } from 'react';
import styled from 'styled-components';

import {
  use05GroupMembers,
  useConversationUsername,
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
import { localize } from '../../../localization/localeTools';
import { groupInfoActions } from '../../../state/ducks/metaGroups';
import { updateConfirmModal } from '../../../state/ducks/modalDialog';
import { SessionButtonColor, SessionButton, SessionButtonType } from '../../basic/SessionButton';
import { ConvoHub } from '../../../session/conversations';
import { ConversationTypeEnum } from '../../../models/types';
import { Constants } from '../../../session';
import { useShowConversationSettingsFor } from '../../menuAndSettingsHooks/useShowConversationSettingsFor';
import { sectionActions } from '../../../state/ducks/section';

export const ConversationHeaderWithDetails = () => {
  const isSelectionMode = useIsMessageSelectionMode();
  const selectedConvoKey = useSelectedConversationKey();
  const isOutgoingRequest = useIsOutgoingRequest(selectedConvoKey);
  const isIncomingRequest = useIsIncomingRequest(selectedConvoKey);
  const isBlocked = useSelectedIsBlocked();

  const showConvoSettingsCb = useShowConversationSettingsFor(selectedConvoKey);

  if (!selectedConvoKey) {
    return null;
  }

  return (
    <div className="module-conversation-header">
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
            <AvatarHeader
              onAvatarClick={
                showConvoSettingsCb
                  ? () => {
                      showConvoSettingsCb({ settingsModalPage: 'default' });
                    }
                  : undefined
              }
              pubkey={selectedConvoKey}
            />
          </Flex>
        )}
      </Flex>

      {isSelectionMode && <SelectionOverlay />}
    </div>
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
  const dispatch = useDispatch();

  return useCallback(
    (name: string, members: Array<PubkeyType>) => {
      dispatch(
        updateConfirmModal({
          title: localize('recreateGroup').toString(),
          i18nMessage: { token: 'legacyGroupChatHistory' },
          okText: localize('theContinue').toString(),
          cancelText: localize('cancel').toString(),
          okTheme: SessionButtonColor.Danger,
          onClickOk: () => {
            dispatch(sectionActions.setLeftOverlayMode('closed-group'));
            dispatch(groupInfoActions.updateGroupCreationName({ name }));
            dispatch(groupInfoActions.setSelectedGroupMembers({ membersToSet: members }));
          },
          onClickClose: () => {
            dispatch(updateConfirmModal(null));
          },
        })
      );
    },
    [dispatch]
  );
}

function RecreateGroupButton() {
  const isLegacyGroup = useSelectedIsLegacyGroup();
  const selectedConvo = useSelectedConversationKey();

  const name = useConversationUsername(selectedConvo);
  const members = use05GroupMembers(selectedConvo);

  const weAreAdmin = useSelectedWeAreAdmin();

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
            for (let index = 0; index < members.length; index++) {
              const m = members[index];
              /* eslint-disable no-await-in-loop */
              const memberConvo = await ConvoHub.use().getOrCreateAndWait(
                m,
                ConversationTypeEnum.PRIVATE
              );
              if (!memberConvo.get('active_at')) {
                memberConvo.set({
                  active_at: Constants.CONVERSATION.LAST_JOINED_FALLBACK_TIMESTAMP,
                });
                await memberConvo.commit();
              }
              /* eslint-enable no-await-in-loop */
            }
          } catch (e) {
            window.log.warn('recreate group: failed to recreate a member convo', e.message);
          }
          showRecreateGroupModal(name || localize('groupUnknown').toString(), members);
        }}
      >
        {localize('recreateGroup')}
      </SessionButton>
    </RecreateGroupContainer>
  );
}
