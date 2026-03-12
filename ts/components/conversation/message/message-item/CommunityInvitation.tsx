import styled from 'styled-components';
import { useMemo } from 'react';
import { acceptOpenGroupInvitation } from '../../../../interactions/messageInteractions';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';
import {
  useMessageCommunityInvitationFullUrl,
  useMessageCommunityInvitationCommunityName,
  useMessageDirectionIncoming,
} from '../../../../state/selectors';
import type { WithMessageId } from '../../../../session/types/with';
import { SessionLucideIconButton } from '../../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { tr } from '../../../../localization/localeTools';

const StyledCommunityInvitation = styled.div<{ $isIncoming: boolean }>`
  background-color: ${props =>
    props.$isIncoming
      ? 'var(--message-bubble-incoming-background-color)'
      : 'var(--message-bubble-outgoing-background-color)'};
  color: ${props =>
    props.$isIncoming
      ? 'var(--message-bubble-incoming-text-color)'
      : 'var(--message-bubble-outgoing-text-color)'};

  padding: var(--margins-sm);
  border-radius: var(--border-radius-message-box);
  cursor: pointer;
`;

const StyledCommunityContentsContainer = styled.div`
  display: flex;
  align-items: center;
`;

const StyledCommunityDetailsContainer = styled.div`
  display: inline-flex;
  flex-direction: column;
  padding: 0px var(--margins-sm);
  line-height: var(--font-line-height);
`;

const StyledCommunityName = styled.div`
  font-weight: bold;
  font-size: var(--font-size-lg);
`;

const StyledCommunityType = styled.div`
  font-size: var(--font-size-sm);
`;

const StyledCommunityUrl = styled.div`
  font-size: var(--font-size-xs);
`;

const StyledIconContainer = styled.div`
  background-color: var(--message-link-preview-background-color);
  border-radius: 100%;
`;

export const CommunityInvitation = ({ messageId }: WithMessageId) => {
  const isIncoming = useMessageDirectionIncoming(messageId);

  const fullUrl = useMessageCommunityInvitationFullUrl(messageId);
  const communityName = useMessageCommunityInvitationCommunityName(messageId);

  const hostname = useMemo(() => {
    try {
      const url = new URL(fullUrl || '');
      return url.origin;
    } catch (e) {
      window?.log?.warn('failed to get hostname from open groupv2 invitation', fullUrl);
      return '';
    }
  }, [fullUrl]);

  if (!fullUrl || !hostname) {
    return null;
  }

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      key={`readable-message-${messageId}`}
      dataTestId="control-message"
    >
      <StyledCommunityInvitation
        $isIncoming={isIncoming}
        onClick={() => {
          acceptOpenGroupInvitation(fullUrl, communityName);
        }}
      >
        <StyledCommunityContentsContainer>
          <StyledIconContainer>
            <SessionLucideIconButton
              iconColor={'var(--message-bubble-outgoing-text-color)'}
              backgroundColor={isIncoming ? 'var(--primary-color)' : undefined}
              unicode={isIncoming ? LUCIDE_ICONS_UNICODE.PLUS : LUCIDE_ICONS_UNICODE.GLOBE}
              iconSize={'large'}
              padding="var(--margins-xs)"
            />
          </StyledIconContainer>
          <StyledCommunityDetailsContainer data-testid="community-invitation-details">
            <StyledCommunityName>{communityName}</StyledCommunityName>
            <StyledCommunityType>{tr('communityInvitation')}</StyledCommunityType>
            <StyledCommunityUrl>{hostname}</StyledCommunityUrl>
          </StyledCommunityDetailsContainer>
        </StyledCommunityContentsContainer>
      </StyledCommunityInvitation>
    </ExpirableReadableMessage>
  );
};
