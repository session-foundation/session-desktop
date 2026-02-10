import styled from 'styled-components';
import { useIsIncomingRequest, useIsOutgoingRequest } from '../../hooks/useParamSelector';
import { handleAcceptConversationRequestWithoutConfirm } from '../../interactions/conversationInteractions';
import {
  useSelectedConversationKey,
  useSelectedIsGroupV2,
  useSelectedIsPrivateFriend,
} from '../../state/selectors/selectedConversation';
import { useLibGroupInvitePending } from '../../state/selectors/userGroups';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import {
  ConversationIncomingRequestExplanation,
  ConversationOutgoingRequestExplanation,
} from './SubtleNotification';
import { NetworkTime } from '../../util/NetworkTime';
import { tr } from '../../localization/localeTools';
import { useDeclineMessageRequest } from '../menuAndSettingsHooks/useDeclineMessageRequest';

const MessageRequestContainer = styled.div`
  display: flex;
  flex-direction: column-reverse;
  justify-content: center;
  padding: var(--margins-lg);
  gap: var(--margins-lg);
  text-align: center;
  background: var(--background-secondary-color);
`;

const ConversationBannerRow = styled.div`
  display: flex;
  flex-direction: row;
  gap: var(--margins-lg);
  justify-content: center;

  .session-button {
    padding: 0 36px;
  }
`;

const StyledBlockUserText = styled.span`
  color: var(--danger-color);
  cursor: pointer;
  font-size: var(--font-size-md);
  align-self: center;
  font-weight: 700;
`;

export const ConversationMessageRequestButtons = () => {
  const selectedConvoId = useSelectedConversationKey();
  const isIncomingRequest = useIsIncomingRequest(selectedConvoId);
  const isGroupV2 = useSelectedIsGroupV2();
  const isPrivateAndFriend = useSelectedIsPrivateFriend();
  const isGroupPendingInvite = useLibGroupInvitePending(selectedConvoId);
  const isOutgoingRequest = useIsOutgoingRequest(selectedConvoId);
  const declineCb = useDeclineMessageRequest({ conversationId: selectedConvoId, alsoBlock: false });
  const declineAndBlockCb = useDeclineMessageRequest({
    conversationId: selectedConvoId,
    alsoBlock: true,
  });

  if (
    !selectedConvoId ||
    isPrivateAndFriend || // if we are already friends, there is no need for the msg request buttons
    (isGroupV2 && !isGroupPendingInvite) ||
    (!isIncomingRequest && !isOutgoingRequest) // if it's not a message request
  ) {
    return null;
  }

  return (
    <MessageRequestContainer>
      {declineCb ? (
        <ConversationBannerRow>
          <SessionButton
            buttonColor={SessionButtonColor.PrimaryDark}
            text={tr('accept')}
            onClick={() => {
              void handleAcceptConversationRequestWithoutConfirm({
                convoId: selectedConvoId,
                approvalMessageTimestamp: NetworkTime.now(),
              });
            }}
            dataTestId="accept-message-request"
          />
          <SessionButton
            buttonColor={SessionButtonColor.Danger}
            text={tr('delete')}
            onClick={declineCb}
            dataTestId="delete-message-request"
          />
        </ConversationBannerRow>
      ) : null}

      {isIncomingRequest ? <ConversationIncomingRequestExplanation /> : null}

      {isOutgoingRequest ? (
        <ConversationOutgoingRequestExplanation />
      ) : (
        <>
          {declineAndBlockCb ? (
            <StyledBlockUserText
              onClick={declineAndBlockCb}
              data-testid="decline-and-block-message-request"
            >
              {tr('block')}
            </StyledBlockUserText>
          ) : null}
        </>
      )}
    </MessageRequestContainer>
  );
};
