import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { closeRightPanel } from '../../../state/ducks/conversations';
import { resetRightOverlayMode } from '../../../state/ducks/section';
import {
  useSelectedDisplayNameInProfile,
  useSelectedIsBlocked,
  useSelectedIsKickedFromGroup,
  useSelectedIsGroupDestroyed,
  useSelectedIsGroupOrCommunity,
  useSelectedIsGroupV2,
  useSelectedIsPublic,
  useSelectedWeAreAdmin,
} from '../../../state/selectors/selectedConversation';
import { Avatar, AvatarSize } from '../../avatar/Avatar';
import { Flex } from '../../basic/Flex';
import { Localizer } from '../../basic/Localizer';
import { SpacerMD } from '../../basic/Text';
import { Header } from '../../conversation/right-panel/overlay/components';
import type { WithConvoId } from '../../../session/types/with';
import { useSubscriberCount } from '../../../state/selectors/sogsRoomInfo';

function SubscriberCount(props: WithConvoId) {
  const subscriberCount = useSubscriberCount(props.conversationId);

  const showMemberCount = !!(subscriberCount && subscriberCount > 0);

  if (!showMemberCount) {
    return null;
  }

  return (
    <Flex $container={true} $flexDirection={'column'}>
      <div role="button" className="subtle">
        <Localizer token="members" args={{ count: subscriberCount }} />
      </div>
      <SpacerMD />
    </Flex>
  );
}

export const ConversationSettingsHeader = ({ conversationId }: WithConvoId) => {
  const dispatch = useDispatch();
  const displayNameInProfile = useSelectedDisplayNameInProfile();
  const isBlocked = useSelectedIsBlocked();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const isGroupDestroyed = useSelectedIsGroupDestroyed();
  const isGroup = useSelectedIsGroupOrCommunity();
  const isGroupV2 = useSelectedIsGroupV2();
  const isPublic = useSelectedIsPublic();
  const weAreAdmin = useSelectedWeAreAdmin();

  if (!conversationId) {
    return null;
  }

  const showInviteLegacyGroup =
    !isPublic && !isGroupV2 && isGroup && !isKickedFromGroup && !isBlocked;
  const showInviteGroupV2 =
    isGroupV2 && !isKickedFromGroup && !isBlocked && weAreAdmin && !isGroupDestroyed;
  const showInviteContacts = isPublic || showInviteLegacyGroup || showInviteGroupV2;

  return (
    <Header
      backButtonDirection="right"
      backButtonOnClick={() => {
        dispatch(closeRightPanel());
        dispatch(resetRightOverlayMode());
      }}
      hideCloseButton={true}
      hideBackButton={true}
    >
      <Flex
        $container={true}
        $justifyContent={'center'}
        $alignItems={'center'}
        width={'100%'}
        style={{ position: 'relative' }}
      >
        <Avatar size={AvatarSize.XL} pubkey={conversationId} />
      </Flex>

      <StyledName data-testid="right-panel-group-name">{displayNameInProfile}</StyledName>
      <SubscriberCount conversationId={conversationId} />
    </Header>
  );
};

const StyledName = styled.h4`
  padding-inline: var(--margins-md);
  font-size: var(--font-size-md);
`;
