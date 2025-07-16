import styled from 'styled-components';
import { useEffect, useRef, useState, type SessionDataTestId } from 'react';

import { Avatar, AvatarSize } from '../../avatar/Avatar';
import { Flex } from '../../basic/Flex';
import { Header } from '../../conversation/right-panel/overlay/components';
import type { WithConvoId } from '../../../session/types/with';
import {
  useConversationRealName,
  useHasNickname,
  useIsClosedGroup,
  useIsMe,
  useIsPrivate,
  useIsPublic,
  useNicknameOrProfileNameOrShortenedPubkey,
} from '../../../hooks/useParamSelector';
import { PubKey } from '../../../session/types';
import { H7 } from '../../basic/Heading';
import { localize } from '../../../localization/localeTools';
import { useChangeNickname } from '../../menuAndSettingsHooks/useChangeNickname';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { useEditProfilePictureCallback } from '../../menuAndSettingsHooks/useEditProfilePictureCallback';
import { useRoomDescription } from '../../../state/selectors/sogsRoomInfo';
import { useLibGroupDescription } from '../../../state/selectors/groups';
import { useShowUpdateGroupNameDescriptionCb } from '../../menuAndSettingsHooks/useShowUpdateGroupNameDescription';
import { useHTMLDirection } from '../../../util/i18n/rtlSupport';

function AccountId({ conversationId }: WithConvoId) {
  const isPrivate = useIsPrivate(conversationId);

  if (!isPrivate || PubKey.isBlinded(conversationId)) {
    return null;
  }
  const len = conversationId.length;

  return (
    <StyledAccountId data-testid="account-id">
      {conversationId.slice(0, len / 2)}
      <br />
      {conversationId.slice(len / 2)}
    </StyledAccountId>
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

/**
 * Return the callback to use for the title click event, if one is allowed
 */
function useOnTitleClickCb(conversationId: string) {
  const changeNicknameCb = useChangeNickname(conversationId);
  const updateNameDescCb = useShowUpdateGroupNameDescriptionCb({ conversationId });
  return changeNicknameCb || updateNameDescCb;
}

function ChangeNicknameButton({ conversationId }: WithConvoId) {
  const changeNicknameCb = useChangeNickname(conversationId);

  return <EditGenericButton cb={changeNicknameCb} dataTestId="set-nickname-confirm-button" />;
}

function UpdateNameDescriptionButton({ conversationId }: WithConvoId) {
  const updateNameDescCb = useShowUpdateGroupNameDescriptionCb({ conversationId });

  return <EditGenericButton cb={updateNameDescCb} dataTestId="edit-group-name" />;
}

const StyledAccountId = styled.div`
  color: var(--text-secondary-color);
  text-align: center;
  font-weight: 400;
  line-height: 1.2;
  font-size: var(--font-display-size-sm);
  font-family: var(--font-mono);
`;

const StyledDescription = styled.p<{ expanded: boolean }>`
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
          {expanded ? localize('viewLess') : localize('viewMore')}
        </StyledViewMoreButton>
      )}
    </>
  );
}

const ConversationTitle = ({ conversationId }: WithConvoId) => {
  const nicknameOrDisplayName = useNicknameOrProfileNameOrShortenedPubkey(conversationId);
  const isCommunity = useIsPublic(conversationId);
  const isClosedGroup = useIsClosedGroup(conversationId);
  const isMe = useIsMe(conversationId);

  const onClickCb = useOnTitleClickCb(conversationId);

  // the data-test-id depends on the type of conversation
  const dataTestId = isCommunity
    ? 'community-name'
    : isClosedGroup
      ? 'group-name'
      : // for 1o1, this will hold the nickname if set, or the display name
        'preferred-display-name';

  return (
    <H7
      dataTestId={dataTestId}
      style={{
        wordBreak: 'break-all',
        textAlign: 'center',
        cursor: onClickCb ? 'pointer' : 'inherit',
      }}
      onClick={onClickCb || undefined}
    >
      {isMe ? localize('noteToSelf').toString() : nicknameOrDisplayName}
    </H7>
  );
};

export const ConversationSettingsHeader = ({ conversationId }: WithConvoId) => {
  // if a nickname is set, we still want to display the real name of the user, as he defined it
  const conversationRealName = useConversationRealName(conversationId);
  const hasNickname = useHasNickname(conversationId);
  const isMe = useIsMe(conversationId);

  const editProfilePictureCb = useEditProfilePictureCallback({ conversationId });
  const htmlDirection = useHTMLDirection();

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
        $flexGap="var(--margins-sm)"
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
          <ConversationTitle conversationId={conversationId} />
          <ChangeNicknameButton conversationId={conversationId} />
          <UpdateNameDescriptionButton conversationId={conversationId} />
        </Flex>
        {hasNickname && conversationRealName ? (
          <StyledAccountId data-testid="fallback-display-name">
            ({conversationRealName})
          </StyledAccountId>
        ) : null}
        <Description conversationId={conversationId} />
        <AccountId conversationId={conversationId} />
      </Flex>
    </Header>
  );
};
