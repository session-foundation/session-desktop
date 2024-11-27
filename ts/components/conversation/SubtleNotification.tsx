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
  useSelectedIsGroupV2,
  useSelectedIsNoteToSelf,
  useSelectedIsPrivate,
  useSelectedNicknameOrProfileNameOrShortenedPubkey,
} from '../../state/selectors/selectedConversation';
import {
  useLibGroupDestroyed,
  useLibGroupInviteGroupName,
  useLibGroupInvitePending,
  useLibGroupKicked,
  useLibGroupWeHaveSecretKey,
} from '../../state/selectors/userGroups';
import { localize } from '../../util/i18n/localizedString';
import { SessionHtmlRenderer } from '../basic/SessionHTMLRenderer';

const Container = styled.div<{ noExtraPadding: boolean }>`
  display: flex;
  flex-direction: row;
  justify-content: center;
  background-color: var(--background-secondary-color);
  padding: ${props => (props.noExtraPadding ? '' : 'var(--margins-lg)')};
`;

const TextInner = styled.div`
  color: var(--text-secondary-color);
  text-align: center;
  max-width: 390px;
`;

function TextNotification({
  html,
  dataTestId,
  noExtraPadding,
}: {
  html: string;
  dataTestId: SessionDataTestId;
  noExtraPadding: boolean;
}) {
  return (
    <Container data-testid={dataTestId} noExtraPadding={noExtraPadding}>
      <TextInner>
        <SessionHtmlRenderer html={html} />
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
      html={window.i18n('messageRequestsAcceptDescription')}
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
      html={window.i18n('messageRequestGroupInviteDescription')}
      noExtraPadding={true} // in this case, `TextNotification` is part of a bigger component spacing each already
    />
  );
};

export const InvitedToGroupControlMessage = () => {
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
  const html = conversationOrigin
    ? weHaveSecretKey
      ? window.i18n('groupInviteReinvite', {
          group_name: groupName,
          name: adminNameInvitedUs,
        })
      : window.i18n('messageRequestGroupInvite', {
          group_name: groupName,
          name: adminNameInvitedUs,
        })
    : weHaveSecretKey
      ? window.i18n('groupInviteReinviteYou', { group_name: groupName })
      : window.i18n('groupInviteYou');

  return (
    <TextNotification
      dataTestId="group-invite-control-message"
      html={html}
      noExtraPadding={true} // in this case, `TextNotification` is part of a bigger component spacing each already
    />
  );
};

export const NoMessageInConversation = () => {
  const selectedConversation = useSelectedConversationKey();
  const hasMessages = useSelectedHasMessages();
  const isGroupV2 = useSelectedIsGroupV2();
  const isInvitePending = useLibGroupInvitePending(selectedConversation);

  const isMe = useSelectedIsNoteToSelf();
  const canWrite = useSelector(getSelectedCanWrite);
  const privateBlindedAndBlockingMsgReqs = useSelectedHasDisabledBlindedMsgRequests();

  const isPrivate = useSelectedIsPrivate();
  const isIncomingRequest = useIsIncomingRequest(selectedConversation);
  const isKickedFromGroup = useLibGroupKicked(selectedConversation);
  const isGroupDestroyed = useLibGroupDestroyed(selectedConversation);
  const name = useSelectedNicknameOrProfileNameOrShortenedPubkey();

  const getHtmlToRender = () => {
    if (isMe) {
      return localize('noteToSelfEmpty').toString();
    }

    if (canWrite) {
      return localize('groupNoMessages').withArgs({ group_name: name }).toString();
    }

    if (privateBlindedAndBlockingMsgReqs) {
      return localize('messageRequestsTurnedOff').withArgs({ name }).toString();
    }

    if (isGroupV2 && isGroupDestroyed) {
      return localize('groupDeletedMemberDescription').withArgs({ group_name: name }).toString();
    }

    if (isGroupV2 && isKickedFromGroup) {
      return localize('groupRemovedYou').withArgs({ group_name: name }).toString();
    }
    return localize('conversationsEmpty').withArgs({ conversation_name: name }).toString();
  };

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
      html={getHtmlToRender()}
      noExtraPadding={false} // in this case, `TextNotification` is **not** part of a bigger component so we need to add some spacing
    />
  );
};
