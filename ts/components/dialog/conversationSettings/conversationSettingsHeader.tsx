import styled from 'styled-components';
import { useEffect, useRef, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { Flex } from '../../basic/Flex';
import { Header } from '../../conversation/right-panel/overlay/components';
import type { WithConvoId } from '../../../session/types/with';
import { useIsMe, useIsPrivate, useIsPublic } from '../../../hooks/useParamSelector';
import { PubKey } from '../../../session/types';
import { tr } from '../../../localization/localeTools';
import { useEditProfilePictureCallback } from '../../menuAndSettingsHooks/useEditProfilePictureCallback';
import { useRoomDescription } from '../../../state/selectors/sogsRoomInfo';
import { useLibGroupDescription } from '../../../state/selectors/groups';
import { useHTMLDirection } from '../../../util/i18n/rtlSupport';
import { UsernameFallback } from './UsernameFallback';
import { ConversationTitleDialog } from './ConversationTitleDialog';
import { SessionIDNotEditable } from '../../basic/SessionIdNotEditable';
import { AccountIdPill } from '../../basic/AccountIdPill';
import { ProfileHeader } from '../user-settings/components';
import type { ProfileDialogModes } from '../user-settings/ProfileDialogModes';
import { SessionUtilUserGroups } from '../../../session/utils/libsession/libsession_utils_user_groups';
import { QRView } from '../../qrview/QrView';

function AccountId({ conversationId }: WithConvoId) {
  const isPrivate = useIsPrivate(conversationId);

  if (!isPrivate) {
    return null;
  }

  if (PubKey.isBlinded(conversationId)) {
    // the settings menu should not be shown in the first place
    throw new Error('AccountId: Blinded conversationId');
  }

  return (
    <SessionIDNotEditable
      dataTestId="account-id"
      sessionId={conversationId}
      displayType="2lines"
      tooltipNode={null}
      style={{ color: 'var(--text-primary-color)' }}
    />
  );
}

const StyledDescription = styled.div<{ $expanded: boolean }>`
  color: var(--text-secondary-color);
  font-size: var(--font-display-size-md);
  text-align: center;
  font-weight: 400;
  line-height: 1.2;
  background: transparent;
  width: 100%;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: hidden;
  -webkit-line-clamp: ${({ $expanded }) => ($expanded ? 'unset' : '2')};
  display: -webkit-box;
  -webkit-box-orient: vertical;
  // some padding so we always have room to show the ellipsis, if needed
  padding-inline: var(--margins-sm);
`;

const StyledViewMoreButton = styled.button`
  color: var(--text-secondary-color);
  text-align: center;
  font-weight: 700;
  transition-duration: var(--default-duration);

  &:hover {
    color: var(--text-primary-color);
  }
`;

function Description({ conversationId }: WithConvoId) {
  const roomDescription = useRoomDescription(conversationId);
  const groupDescription = useLibGroupDescription(conversationId);
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  const description = roomDescription || groupDescription;

  // small hook to detect if View More/Less button should be shown, depending on
  // if the description is overflowing the container
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const isOverflowing = el.scrollHeight > el.clientHeight;

    setIsClamped(isOverflowing);
  }, [description]);

  if (!description) {
    return null;
  }

  return (
    <>
      <StyledDescription data-testid="group-description" $expanded={expanded} ref={ref}>
        {description}
      </StyledDescription>
      {isClamped && (
        <StyledViewMoreButton onClick={() => setExpanded(!expanded)}>
          {expanded ? tr('viewLess') : tr('viewMore')}
        </StyledViewMoreButton>
      )}
    </>
  );
}

export const ConversationSettingsHeader = ({ conversationId }: WithConvoId) => {
  // if a nickname is set, we still want to display the real name of the user, as he defined it
  const isMe = useIsMe(conversationId);

  const editProfilePictureCb = useEditProfilePictureCallback({ conversationId });
  const htmlDirection = useHTMLDirection();

  const isPrivateUnblinded = useIsPrivate(conversationId) && !PubKey.isBlinded(conversationId);
  const [mode, setMode] = useState<ProfileDialogModes>('default');
  const isPublic = useIsPublic(conversationId);
  const [fullUrlWithPubkey, setFullUrlWithPubkey] = useState<string | null>(null);

  useAsync(async () => {
    if (!conversationId || !isPublic) {
      return;
    }
    const roomDetails = await SessionUtilUserGroups.getCommunityByConvoIdNotCached(conversationId);
    if (!roomDetails) {
      throw new Error(`getCommunityByFullUrl returned no result for ${conversationId}`);
    }
    setFullUrlWithPubkey(roomDetails.fullUrlWithPubkey);
  }, [conversationId]);

  const [enlargedImage, setEnlargedImage] = useState(false);

  if (!conversationId) {
    return null;
  }

  return (
    <Header hideCloseButton={true} paddingTop="var(--margins-xs)">
      <Flex
        $container={true}
        $justifyContent={'center'}
        $alignItems={'center'}
        width={'100%'}
        $flexDirection="column"
        $flexGap="var(--margins-lg)"
      >
        {mode === 'qr' ? (
          <QRView
            sessionID={(isPublic && fullUrlWithPubkey) || conversationId}
            onExit={() => setMode('default')}
          />
        ) : (
          <ProfileHeader
            conversationId={conversationId}
            dataTestId="profile-picture"
            // 1. We don't want to show the plus button for the current user
            // as he needs to change his avatar through the UserSettingsModal
            // 2. We don't want to show the plus button for communities as they already have a qr button.
            // Editing the avatar is done through the pencil icon in the ModalHeader
            onPlusAvatarClick={!isMe && !isPublic ? (editProfilePictureCb ?? null) : null}
            avatarPath={null}
            onQRClick={(isPrivateUnblinded && !isMe) || isPublic ? () => setMode('qr') : null}
            enlargedImage={enlargedImage}
            toggleEnlargedImage={() => setEnlargedImage(!enlargedImage)}
          />
        )}
        <Flex
          $container={true}
          $alignItems={'center'}
          $flexDirection={'row'}
          $flexGap="var(--margins-xs)"
          style={{ direction: htmlDirection }}
        >
          <ConversationTitleDialog conversationId={conversationId} editable={true} />
        </Flex>
        <UsernameFallback conversationId={conversationId} />
        <Description conversationId={conversationId} />
        {isPrivateUnblinded ? <AccountIdPill accountType={isMe ? 'ours' : 'theirs'} /> : null}
        <AccountId conversationId={conversationId} />
      </Flex>
    </Header>
  );
};
