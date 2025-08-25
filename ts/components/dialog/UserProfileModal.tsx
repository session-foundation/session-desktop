import { useState } from 'react';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { ConvoHub } from '../../session/conversations';
import { openConversationWithMessages } from '../../state/ducks/conversations';
import { updateUserProfileModal, UserProfileModalState } from '../../state/ducks/modalDialog';
import { SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { CopyToClipboardButton } from '../buttons/CopyToClipboardButton';
import { ConversationTypeEnum } from '../../models/types';
import { Flex } from '../basic/Flex';
import { AccountIdPill } from '../basic/AccountIdPill';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
  ModalBottomButtonWithBorder,
} from '../SessionWrapperModal';
import { tr } from '../../localization/localeTools';
import { PubKey } from '../../session/types';
import type { ProfileDialogModes } from './user-settings/ProfileDialogModes';
import { ProfileHeader } from './user-settings/components';
import { useAvatarPath, useConversationUsernameWithFallback } from '../../hooks/useParamSelector';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { useHasDisabledBlindedMsgRequests } from '../../state/selectors/conversations';
import { Localizer } from '../basic/Localizer';
import { SessionTooltip } from '../SessionTooltip';
import { shortenDisplayName } from '../../session/profile_manager/ShortenDisplayName';
import { UsernameFallback } from './conversationSettings/UsernameFallback';
import { ConversationTitleDialog } from './conversationSettings/ConversationTitleDialog';
import { SessionIDNotEditable } from '../basic/SessionIdNotEditable';
import { QRView } from '../qrview/QrView';

const StyledHasDisabledMsgRequests = styled.div`
  max-width: 42ch;
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  text-align: center;
`;

function HasDisabledMsgRequests({ conversationId }: { conversationId: string }) {
  const username = useConversationUsernameWithFallback(true, conversationId);
  const name = shortenDisplayName(username);

  return (
    <StyledHasDisabledMsgRequests>
      <Localizer token="messageRequestsTurnedOff" name={name} />
    </StyledHasDisabledMsgRequests>
  );
}

export const UserProfileModal = ({
  conversationId,
  realSessionId,
}: NonNullable<UserProfileModalState>) => {
  const dispatch = useDispatch();
  const [enlargedImage, setEnlargedImage] = useState(false);

  const isBlinded = PubKey.isBlinded(conversationId);
  const isBlindedAndNotResolved = isBlinded && !realSessionId;
  const isBlindedAndResolved = isBlinded && !!realSessionId;
  const conversationIdToDisplay = isBlindedAndResolved ? realSessionId : conversationId;

  const avatarPath = useAvatarPath(conversationIdToDisplay) || '';
  const profileName = useConversationUsernameWithFallback(false, conversationIdToDisplay) || '';

  function closeDialog() {
    dispatch(updateUserProfileModal(null));
  }

  const [mode, setMode] = useState<ProfileDialogModes>('default');

  const hasDisabledMsgRequests = useHasDisabledBlindedMsgRequests(conversationId);
  const blindedAndDisabledMsgRequests = isBlindedAndNotResolved && hasDisabledMsgRequests;

  async function onClickStartConversation() {
    if (isBlindedAndNotResolved && hasDisabledMsgRequests) {
      return;
    }
    const convo = ConvoHub.use().get(conversationIdToDisplay);

    const conversation = await ConvoHub.use().getOrCreateAndWait(
      convo.id,
      ConversationTypeEnum.PRIVATE
    );

    await openConversationWithMessages({ conversationKey: conversation.id, messageId: null });

    closeDialog();
  }

  useKey(
    'Enter',
    () => {
      void onClickStartConversation();
    },
    undefined
  );

  return (
    <SessionWrapperModal
      headerChildren={<ModalBasicHeader title={''} showExitIcon={true} />}
      onClose={closeDialog}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Outline}>
          <ModalBottomButtonWithBorder
            text={tr('message')}
            onClick={onClickStartConversation}
            dataTestId="new-session-conversation"
            disabled={isBlindedAndNotResolved && hasDisabledMsgRequests}
          />

          {!isBlindedAndNotResolved && (
            <CopyToClipboardButton
              copyContent={conversationIdToDisplay}
              buttonColor={SessionButtonColor.PrimaryDark}
              dataTestId="copy-button-account-id"
              buttonType={SessionButtonType.Outline}
              hotkey={true}
            />
          )}
        </ModalActionsContainer>
      }
    >
      <Flex
        $container={true}
        width={'100%'}
        $justifyContent="center"
        $alignItems="center"
        $flexDirection="column"
        $flexGap="var(--margins-md)"
        paddingBlock="0 var(--margins-lg)"
        style={{ position: 'relative' }}
      >
        {mode === 'qr' ? (
          <QRView sessionID={conversationIdToDisplay} onExit={() => setMode('default')} />
        ) : (
          <ProfileHeader
            avatarPath={avatarPath}
            conversationId={conversationIdToDisplay}
            onPlusAvatarClick={null} // no + icon in this modal
            dataTestId="avatar-user-profile-dialog"
            onQRClick={
              blindedAndDisabledMsgRequests
                ? null
                : () => {
                    setMode('qr');
                  }
            }
            enlargedImage={enlargedImage}
            toggleEnlargedImage={() => setEnlargedImage(!enlargedImage)}
          />
        )}

        <ConversationTitleDialog conversationId={conversationIdToDisplay} editable={false} />
        <UsernameFallback conversationId={conversationIdToDisplay} />
        <AccountIdPill accountType={isBlindedAndNotResolved ? 'blinded' : 'theirs'} />
        <SessionIDNotEditable
          dataTestId="account-id"
          sessionId={conversationIdToDisplay}
          displayType={
            isBlindedAndNotResolved ? 'blinded' : isBlindedAndResolved ? '3lines' : '2lines'
          }
          style={{ color: 'var(--text-primary-color)' }}
          tooltipNode={
            <SessionTooltip
              content={
                !isBlinded ? null : isBlindedAndResolved ? (
                  <Localizer
                    token="tooltipAccountIdVisible"
                    name={shortenDisplayName(profileName)}
                    className="session-id-tooltip"
                  />
                ) : (
                  <Localizer token="tooltipBlindedIdCommunities" className="session-id-tooltip" />
                )
              }
              dataTestId="tooltip-info"
            >
              <SessionLucideIconButton
                unicode={LUCIDE_ICONS_UNICODE.CIRCLE_HELP}
                iconColor="var(--text-primary-color)"
                iconSize="small"
                dataTestId="tooltip"
              />
            </SessionTooltip>
          }
        />
        {blindedAndDisabledMsgRequests ? (
          <HasDisabledMsgRequests conversationId={conversationId} />
        ) : null}
      </Flex>
    </SessionWrapperModal>
  );
};
