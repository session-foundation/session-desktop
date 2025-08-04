import styled from 'styled-components';
import { useEffect, useRef, useState, type SessionDataTestId } from 'react';

import { Avatar, AvatarSize } from '../../avatar/Avatar';
import { Flex } from '../../basic/Flex';
import { Header } from '../../conversation/right-panel/overlay/components';
import type { WithConvoId } from '../../../session/types/with';
import { useIsMe, useIsPrivate } from '../../../hooks/useParamSelector';
import { PubKey } from '../../../session/types';
import { tr } from '../../../localization/localeTools';
import { useChangeNickname } from '../../menuAndSettingsHooks/useChangeNickname';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { useEditProfilePictureCallback } from '../../menuAndSettingsHooks/useEditProfilePictureCallback';
import { useRoomDescription } from '../../../state/selectors/sogsRoomInfo';
import { useLibGroupDescription } from '../../../state/selectors/groups';
import { useShowUpdateGroupNameDescriptionCb } from '../../menuAndSettingsHooks/useShowUpdateGroupNameDescription';
import { useHTMLDirection } from '../../../util/i18n/rtlSupport';
import { UsernameFallback } from './UsernameFallback';
import { ConversationTitleDialog } from './ConversationTitleDialog';
import { SessionIDNotEditable } from '../../basic/SessionIdNotEditable';
import { AccountIdPill } from '../../basic/AccountIdPill';

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
      style={{ color: 'var(--text-secondary-color)' }}
    />
  );
}

function EditGenericButton({
  cb,
  dataTestId,
}: {
  cb: (() => void) | null;
  dataTestId: SessionDataTestId;
}) {
  if (!cb) {
    return null;
  }

  return (
    <SessionLucideIconButton
      unicode={LUCIDE_ICONS_UNICODE.PENCIL}
      iconSize="medium"
      onClick={cb}
      dataTestId={dataTestId}
    />
  );
}

function ChangeNicknameButton({ conversationId }: WithConvoId) {
  const changeNicknameCb = useChangeNickname(conversationId);

  return <EditGenericButton cb={changeNicknameCb} dataTestId="set-nickname-confirm-button" />;
}

function UpdateNameDescriptionButton({ conversationId }: WithConvoId) {
  const updateNameDescCb = useShowUpdateGroupNameDescriptionCb({ conversationId });

  return <EditGenericButton cb={updateNameDescCb} dataTestId="edit-group-name" />;
}

const StyledDescription = styled.div<{ expanded: boolean }>`
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
  -webkit-line-clamp: ${({ expanded }) => (expanded ? 'unset' : '2')};
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
      <StyledDescription data-testid="group-description" expanded={expanded} ref={ref}>
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
        <Avatar
          size={AvatarSize.XL}
          pubkey={conversationId}
          dataTestId="profile-picture"
          // we don't want to show the plus button for the current user
          // as he needs to change his avatar through the EditProfileDialog
          onPlusAvatarClick={!isMe ? editProfilePictureCb : undefined}
        />
        <Flex
          $container={true}
          $alignItems={'center'}
          $flexDirection={'row'}
          $flexGap="var(--margins-xs)"
          style={{ direction: htmlDirection }}
        >
          <ConversationTitleDialog conversationId={conversationId} editable={true} />
          <ChangeNicknameButton conversationId={conversationId} />
          <UpdateNameDescriptionButton conversationId={conversationId} />
        </Flex>
        <UsernameFallback conversationId={conversationId} />
        <Description conversationId={conversationId} />
        {isPrivateUnblinded ? <AccountIdPill accountType={isMe ? 'ours' : 'theirs'} /> : null}
        <AccountId conversationId={conversationId} />
      </Flex>
    </Header>
  );
};
