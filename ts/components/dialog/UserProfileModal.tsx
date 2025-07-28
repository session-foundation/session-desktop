import { useState } from 'react';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';

import { ConvoHub } from '../../session/conversations';
import { openConversationWithMessages } from '../../state/ducks/conversations';
import { updateUserProfileModal, UserProfileModalState } from '../../state/ducks/modalDialog';
import { AvatarSize } from '../avatar/Avatar';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import { SpacerLG } from '../basic/Text';
import { CopyToClipboardButton } from '../buttons/CopyToClipboardButton';
import { ConversationTypeEnum } from '../../models/types';
import { Flex } from '../basic/Flex';
import { SessionIDNonEditable, SessionIDPill } from '../basic/SessionIDPill';
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

export const UserProfileModal = ({ conversationId }: NonNullable<UserProfileModalState>) => {
  const dispatch = useDispatch();
  const avatarPath = useAvatarPath(conversationId) || '';
  const profileName = useConversationUsername(conversationId) || '';
  const [isEnlargedImageShown, setIsEnlargedImageShown] = useState(false);
  const avatarSize = isEnlargedImageShown ? AvatarSize.HUGE : AvatarSize.XL;

  function closeDialog() {
    dispatch(updateUserProfileModal(null));
  }

  const [mode, setMode] = useState<Exclude<ProfileDialogModes, 'edit'>>('default');

  const isBlinded = PubKey.isBlinded(conversationId);

  async function onClickStartConversation() {
    const convo = ConvoHub.use().get(conversationId);

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
    undefined,
    [conversationId]
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
            dataTestId="invalid-data-testid"
            style={{ minWidth: '125px' }}
          />

          {!isBlinded && (
            <CopyToClipboardButton
              text={tr('copy')}
              copyContent={conversationId}
              buttonColor={SessionButtonColor.PrimaryDark}
              dataTestId="invalid-data-testid"
              style={{ minWidth: '125px' }}
              hotkey={true}
            />
          )}
        </ModalActionsContainer>
      }
    >
      {mode === 'qr' ? (
        <QRView sessionID={conversationId} setMode={setMode}>
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
          conversationId={conversationId}
          onAvatarClick={() => {
            setIsEnlargedImageShown(!isEnlargedImageShown);
          }}
          onPlusAvatarClick={null} // no + icon in this modal
          onQRClick={() => {
            setMode('qr');
          }}
        />
      )}

      <SpacerLG />
      <Flex
        $container={true}
        width={'100%'}
        $justifyContent="center"
        $alignItems="center"
        $flexDirection="column"
        $flexGap="var(--margins-sm)"
      >
        <SessionIDPill accountType={isBlinded ? 'blinded' : 'theirs'} />
        <SessionIDNonEditable dataTestId="invalid-data-testid" sessionId={conversationId} />
      </Flex>
    </SessionWrapperModal>
  );
};
