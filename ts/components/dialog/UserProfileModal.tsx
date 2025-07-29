import { useState } from 'react';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { ConvoHub } from '../../session/conversations';
import { openConversationWithMessages } from '../../state/ducks/conversations';
import { updateUserProfileModal, UserProfileModalState } from '../../state/ducks/modalDialog';
import { AvatarSize } from '../avatar/Avatar';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import { CopyToClipboardButton } from '../buttons/CopyToClipboardButton';
import { ConversationTypeEnum } from '../../models/types';
import { Flex } from '../basic/Flex';
import { AccountIdPill } from '../basic/AccountIdPill';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { tr } from '../../localization/localeTools';
import { PubKey } from '../../session/types';
import type { ProfileDialogModes } from './edit-profile/EditProfileDialog';
import { ProfileHeader, QRView } from './edit-profile/components';
import { useAvatarPath, useConversationUsername } from '../../hooks/useParamSelector';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { useHasDisabledBlindedMsgRequests } from '../../state/selectors/conversations';
import { Localizer } from '../basic/Localizer';
import { SessionTooltip } from '../SessionTooltip';
import { shortenDisplayName } from '../../session/profile_manager/ShortenDisplayName';
import { UsernameFallback } from './conversationSettings/UsernameFallback';
import { ConversationTitle } from './conversationSettings/ConversationTitle';
import { SessionIDNotEditable } from '../basic/SessionIdNotEditable';

const StyledHasDisabledMsgRequests = styled.div`
  max-width: 42ch;
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  text-align: center;
`;
function HasDisabledMsgRequests({ conversationId }: { conversationId: string }) {
  const username = useConversationUsername(conversationId) ?? PubKey.shorten(conversationId);
  const name = shortenDisplayName(username);

  return (
    <StyledHasDisabledMsgRequests>
      <Localizer token="messageRequestsTurnedOff" args={{ name }} />
    </StyledHasDisabledMsgRequests>
  );
}

export const UserProfileModal = ({
  conversationId,
  realSessionId,
}: NonNullable<UserProfileModalState>) => {
  const dispatch = useDispatch();

  const isBlinded = PubKey.isBlinded(conversationId);
  const isBlindedAndNotResolved = isBlinded && !realSessionId;
  const isBlindedAndResolved = isBlinded && !!realSessionId;
  const conversationIdToDisplay = isBlindedAndResolved ? realSessionId : conversationId;

  const avatarPath = useAvatarPath(conversationIdToDisplay) || '';
  const profileName = useConversationUsername(conversationIdToDisplay) || '';
  const [isEnlargedImageShown, setIsEnlargedImageShown] = useState(false);
  const avatarSize = isEnlargedImageShown ? AvatarSize.HUGE : AvatarSize.XL;

  function closeDialog() {
    dispatch(updateUserProfileModal(null));
  }

  const [mode, setMode] = useState<Exclude<ProfileDialogModes, 'edit'>>('default');

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
        <ModalActionsContainer extraBottomMargin={true}>
          <SessionButton
            text={tr('message')}
            onClick={onClickStartConversation}
            buttonColor={SessionButtonColor.PrimaryDark}
            dataTestId="new-session-conversation"
            style={{ minWidth: '125px' }}
            disabled={isBlindedAndNotResolved && hasDisabledMsgRequests}
          />

          {!isBlindedAndNotResolved && (
            <CopyToClipboardButton
              copyContent={conversationIdToDisplay}
              buttonColor={SessionButtonColor.PrimaryDark}
              dataTestId="copy-button-account-id"
              style={{ minWidth: '125px' }}
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
      >
        {mode === 'qr' ? (
          <QRView sessionID={conversationIdToDisplay} setMode={setMode}>
            <SessionLucideIconButton
              unicode={LUCIDE_ICONS_UNICODE.USER_ROUND}
              iconSize={'large'}
              backgroundColor="var(--primary-color)"
              iconColor="var(--black-color)"
              padding="var(--margins-xs )"
              onClick={() => {
                setMode('default');
              }}
              style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '50%',
              }}
            />
          </QRView>
        ) : (
          <ProfileHeader
            avatarPath={avatarPath}
            profileName={profileName}
            avatarSize={avatarSize}
            conversationId={conversationIdToDisplay}
            onAvatarClick={() => {
              setIsEnlargedImageShown(!isEnlargedImageShown);
            }}
            onPlusAvatarClick={null} // no + icon in this modal
            onQRClick={
              blindedAndDisabledMsgRequests
                ? null
                : () => {
                    setMode('qr');
                  }
            }
          />
        )}
        <ConversationTitle conversationId={conversationIdToDisplay} editable={false} />
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
                    args={{ name: shortenDisplayName(profileName) }}
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
