import { SessionDataTestId } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import {
  useIsIncomingRequest,
  useIsOutgoingRequest,
  useNicknameOrProfileNameOrShortenedPubkey,
} from '../../hooks/useParamSelector';
import { PubKey } from '../../session/types';
import { SessionUtilContact } from '../../session/utils/libsession/libsession_utils_contacts';
import {
  hasSelectedConversationIncomingMessages,
  hasSelectedConversationOutgoingMessages,
  useSelectedHasMessages,
} from '../../state/selectors/conversations';
import {
  getSelectedCanWrite,
  useSelectedConversationIdOrigin,
  useSelectedConversationKey,
  useSelectedHasDisabledBlindedMsgRequests,
  useSelectedIsApproved,
  useSelectedIsGroupOrCommunity,
  useSelectedIsGroupV2,
  useSelectedIsNoteToSelf,
  useSelectedIsPrivate,
  useSelectedIsPublic,
  useSelectedNicknameOrProfileNameOrShortenedPubkey,
} from '../../state/selectors/selectedConversation';
import {
  useLibGroupDestroyed,
  useLibGroupInviteGroupName,
  useLibGroupInvitePending,
  useLibGroupKicked,
  useLibGroupWeHaveSecretKey,
} from '../../state/selectors/userGroups';
import { Localizer, type LocalizerProps } from '../basic/Localizer';

const Container = styled.div<{ noExtraPadding: boolean }>`
  display: flex;
  flex-direction: row;
  justify-content: center;
  background-color: var(--background-secondary-color);

  // add padding only if we have a child.
  &:has(*:not(:empty)) {
    padding: ${props => (props.noExtraPadding ? '' : 'var(--margins-lg)')};
  }
`;

const TextInner = styled.div`
  color: var(--text-secondary-color);
  text-align: center;
  max-width: 390px;
`;

function TextNotification({
  details,
  dataTestId,
  noExtraPadding,
}: {
  details: LocalizerProps;
  dataTestId: SessionDataTestId;
  noExtraPadding: boolean;
}) {
  return (
    <Container data-testid={dataTestId} noExtraPadding={noExtraPadding}>
      <TextInner>
        <Localizer {...details} />
      </TextInner>
    </Container>
  );
}

/**
 * This component is used to display a warning when the user is sending a message request.
 *
 */
export const ConversationOutgoingRequestExplanation = () => {
  const selectedConversation = useSelectedConversationKey();
  const isOutgoingMessageRequest = useIsOutgoingRequest(selectedConversation);
  // FIXME: we shouldn't need to rely on incoming messages being present (they can be deleted, expire, etc)
  const hasIncomingMessages = useSelector(hasSelectedConversationIncomingMessages);

  const showMsgRequestUI = selectedConversation && isOutgoingMessageRequest;

  const selectedIsPrivate = useSelectedIsPrivate();

  if (!showMsgRequestUI || hasIncomingMessages || !selectedIsPrivate) {
    return null;
  }
  const contactFromLibsession = SessionUtilContact.getContactCached(selectedConversation);
  // Note: we want to display this description when the conversation is private (or blinded) AND
  // - the conversation is brand new (and not saved yet in libsession: transient conversation),
  // - the conversation exists in libsession but we are not approved yet.
  // This works because a blinded conversation is not saved in libsession currently, and will only be once approved_me is true
  if (!contactFromLibsession || !contactFromLibsession.approvedMe) {
    return (
      <Container
        data-testid={'empty-conversation-control-message'}
        style={{ padding: 0 }}
        noExtraPadding={true}
      >
        <TextInner>{window.i18n('messageRequestPendingDescription')}</TextInner>
      </Container>
    );
  }
  return null;
};

/**
 * This component is used to display a warning when the user is responding to a message request.
 *
 */
export const ConversationIncomingRequestExplanation = () => {
  const selectedConversation = useSelectedConversationKey();
  const isIncomingMessageRequest = useIsIncomingRequest(selectedConversation);

  const showMsgRequestUI = selectedConversation && isIncomingMessageRequest;
  const hasOutgoingMessages = useSelector(hasSelectedConversationOutgoingMessages);

  const isGroupV2 = useSelectedIsGroupV2();

  if (isGroupV2) {
    return <GroupRequestExplanation />;
  }

  if (!showMsgRequestUI || hasOutgoingMessages) {
    return null;
  }

  return (
    <TextNotification
      dataTestId="conversation-request-explanation"
      details={{ token: 'messageRequestsAcceptDescription' }}
      noExtraPadding={true} // in this case, `TextNotification` is part of a bigger component spacing each already
    />
  );
};

const GroupRequestExplanation = () => {
  const selectedConversation = useSelectedConversationKey();
  const isIncomingMessageRequest = useIsIncomingRequest(selectedConversation);
  const isGroupV2 = useSelectedIsGroupV2();
  const showMsgRequestUI = selectedConversation && isIncomingMessageRequest;
  // isApproved in DB is tracking the pending state for a group
  const isApproved = useSelectedIsApproved();
  const isGroupPendingInvite = useLibGroupInvitePending(selectedConversation);

  if (!showMsgRequestUI || isApproved || !isGroupV2 || !isGroupPendingInvite) {
    return null;
  }
  return (
    <TextNotification
      dataTestId="group-request-explanation"
      details={{ token: 'messageRequestGroupInviteDescription' }}
      noExtraPadding={true} // in this case, `TextNotification` is part of a bigger component spacing each already
    />
  );
};

const InvitedToGroupControlMessage = () => {
  const selectedConversation = useSelectedConversationKey();
  const isGroupV2 = useSelectedIsGroupV2();
  const hasMessages = useSelectedHasMessages();
  const isApproved = useSelectedIsApproved();

  const groupName = useLibGroupInviteGroupName(selectedConversation) || window.i18n('unknown');
  const conversationOrigin = useSelectedConversationIdOrigin();
  const adminNameInvitedUs =
    useNicknameOrProfileNameOrShortenedPubkey(conversationOrigin) || window.i18n('unknown');
  const isGroupPendingInvite = useLibGroupInvitePending(selectedConversation);
  const weHaveSecretKey = useLibGroupWeHaveSecretKey(selectedConversation);

  if (
    !selectedConversation ||
    isApproved ||
    hasMessages || // we don't want to display that "xx invited you" message if there are already other messages (incoming or outgoing)
    !isGroupV2 ||
    (conversationOrigin && !PubKey.is05Pubkey(conversationOrigin)) ||
    !isGroupPendingInvite
  ) {
    return null;
  }
  // when restoring from seed we might not have the pubkey of who invited us, in that case, we just use a fallback
  const details: LocalizerProps = conversationOrigin
    ? weHaveSecretKey
      ? {
          token: 'groupInviteReinvite',
          args: {
            group_name: groupName,
            name: adminNameInvitedUs,
          },
        }
      : {
          token: 'messageRequestGroupInvite',
          args: {
            group_name: groupName,
            name: adminNameInvitedUs,
          },
        }
    : weHaveSecretKey
      ? {
          token: 'groupInviteReinviteYou',
          args: {
            group_name: groupName,
          },
        }
      : {
          token: 'groupInviteYou',
        };

  return (
    <TextNotification
      dataTestId="group-invite-control-message"
      details={details}
      noExtraPadding={true} // in this case, `TextNotification` is part of a bigger component spacing each already
    />
  );
};

export const InvitedToGroup = () => {
  return (
    <Container noExtraPadding={false}>
      <InvitedToGroupControlMessage />
    </Container>
  );
};

function useGetMessageDetailsForNoMessages(): LocalizerProps {
  const selectedConversation = useSelectedConversationKey();
  const isGroupOrCommunity = useSelectedIsGroupOrCommunity();

  const isMe = useSelectedIsNoteToSelf();
  const canWrite = useSelector(getSelectedCanWrite);
  const privateBlindedAndBlockingMsgReqs = useSelectedHasDisabledBlindedMsgRequests();

  const isPrivate = useSelectedIsPrivate();
  const isKickedFromGroup = useLibGroupKicked(selectedConversation);
  const isGroupDestroyed = useLibGroupDestroyed(selectedConversation);
  const name = useSelectedNicknameOrProfileNameOrShortenedPubkey();
  const isPublic = useSelectedIsPublic();

  const argsName = { name };
  const argsGroupName = { group_name: name };
  const argsConversationName = { conversation_name: name };

  // First, handle the "noteToSelf and various "private" cases
  if (isMe) {
    return { token: 'noteToSelfEmpty' };
  }
  if (privateBlindedAndBlockingMsgReqs) {
    return { token: 'messageRequestsTurnedOff', args: argsName };
  }
  if (isPrivate) {
    // "You have no messages from X. Send a message to start the conversation!"
    return { token: 'groupNoMessages', args: argsGroupName };
  }

  if (isPublic) {
    return { token: 'conversationsEmpty', args: argsConversationName };
  }

  // a "group but not public" is a legacy or a groupv2 (isPublic is handled just above)
  if (isGroupOrCommunity) {
    if (isGroupDestroyed) {
      return { token: 'groupDeletedMemberDescription', args: argsGroupName };
    }

    if (isKickedFromGroup) {
      return { token: 'groupRemovedYou', args: argsGroupName };
    }
    if (canWrite) {
      // "You have no messages from X. Send a message to start the conversation!"
      return { token: 'groupNoMessages', args: argsGroupName };
    }
    // if we cannot write for some reason, don't show the "send a message" part
    return { token: 'conversationsEmpty', args: argsConversationName };
  }

  return { token: 'conversationsEmpty', args: argsConversationName };
}

export const NoMessageInConversation = () => {
  const selectedConversation = useSelectedConversationKey();
  const hasMessages = useSelectedHasMessages();
  const isGroupV2 = useSelectedIsGroupV2();
  const isInvitePending = useLibGroupInvitePending(selectedConversation);

  const isPrivate = useSelectedIsPrivate();
  const isIncomingRequest = useIsIncomingRequest(selectedConversation);

  const msgDetails = useGetMessageDetailsForNoMessages();

  // groupV2 use its own invite logic as part of <GroupRequestExplanation />
  if (
    !selectedConversation ||
    hasMessages ||
    (isGroupV2 && isInvitePending) ||
    (isPrivate && isIncomingRequest)
  ) {
    return null;
  }

  return (
    <TextNotification
      dataTestId={'empty-conversation-control-message'}
      details={msgDetails}
      noExtraPadding={false} // in this case, `TextNotification` is **not** part of a bigger component so we need to add some spacing
    />
  );
};
