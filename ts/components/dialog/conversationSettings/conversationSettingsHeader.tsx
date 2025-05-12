import { useDispatch } from 'react-redux';
import styled from 'styled-components';

import { closeRightPanel } from '../../../state/ducks/conversations';
import { resetRightOverlayMode } from '../../../state/ducks/section';
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
import { H4 } from '../../basic/Heading';
import { localize } from '../../../localization/localeTools';
import { useChangeNickname } from '../../menuAndSettingsHooks/useChangeNickname';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';

function AccountId({ conversationId }: WithConvoId) {
  const isPrivate = useIsPrivate(conversationId);

  if (!isPrivate || PubKey.isBlinded(conversationId)) {
    return null;
  }
  return <StyledAccountId data-testid="account-id">{conversationId}</StyledAccountId>;
}

function ChangeNicknameButton({ conversationId }: WithConvoId) {
  const changeNicknameCb = useChangeNickname(conversationId);

  if (!changeNicknameCb) {
    return null;
  }

  return (
    <SessionLucideIconButton
      unicode={LUCIDE_ICONS_UNICODE.PENCIL}
      iconSize="large"
      onClick={changeNicknameCb}
      dataTestId="set-nickname-confirm-button"
    />
  );
}

const FallbackDisplayName = styled.div`
  color: var(--text-secondary-color);
  text-align: center;
  font-size: var(--font-display-size-sm);
  font-weight: 400;
  line-height: 1.2;
`;

export const ConversationSettingsHeader = ({ conversationId }: WithConvoId) => {
  const dispatch = useDispatch();

  const nicknameOrDisplayName = useNicknameOrProfileNameOrShortenedPubkey(conversationId);
  // if a nickname is set, we still want to display the real name of the user, as he defined it
  const conversationRealName = useConversationRealName(conversationId);
  const hasNickname = useHasNickname(conversationId);
  const isMe = useIsMe(conversationId);

  const isCommunity = useIsPublic(conversationId);
  const isClosedGroup = useIsClosedGroup(conversationId);

  if (!conversationId) {
    return null;
  }

  // the data-test-id depends on the type of conversation
  const dataTestId = isCommunity
    ? 'community-name'
    : isClosedGroup
      ? 'group-name'
      : // for 1o1, this will hold the nickname if set, or the display name
        'preferred-display-name';

  return (
    <Header
      backButtonDirection="right"
      backButtonOnClick={() => {
        dispatch(closeRightPanel());
        dispatch(resetRightOverlayMode());
      }}
      hideCloseButton={true}
      hideBackButton={true}
      paddingTop="var(--margins-xs)"
    >
      <Flex
        $container={true}
        $justifyContent={'center'}
        $alignItems={'center'}
        width={'100%'}
        $flexDirection="column"
        $flexGap="var(--margins-sm)"
      >
        <Avatar size={AvatarSize.XL} pubkey={conversationId} dataTestId="profile-picture" />
        <Flex
          $container={true}
          $alignItems={'center'}
          $flexDirection={'row'}
          $flexGap="var(--margins-xs)"
        >
          <H4 dataTestId={dataTestId}>
            {isMe ? localize('noteToSelf').toString() : nicknameOrDisplayName}
          </H4>
          <ChangeNicknameButton conversationId={conversationId} />
        </Flex>
        {hasNickname && conversationRealName ? (
          <FallbackDisplayName data-testid="fallback-display-name">
            ({conversationRealName})
          </FallbackDisplayName>
        ) : null}
        <AccountId conversationId={conversationId} />
      </Flex>
    </Header>
  );
};

const StyledAccountId = styled.div`
  font-family: var(--font-mono);
  font-weight: 400;
  font-size: var(--font-display-size-md);
  text-align: center;
  line-height: 1.2;
`;
