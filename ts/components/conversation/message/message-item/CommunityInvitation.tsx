import styled from 'styled-components';

import { useMemo } from 'react';
import clsx from 'clsx';

import { acceptOpenGroupInvitation } from '../../../../interactions/messageInteractions';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';
import {
  useMessageCommunityInvitationFullUrl,
  useMessageCommunityInvitationCommunityName,
  useMessageDirection,
} from '../../../../state/selectors';
import type { WithMessageId } from '../../../../session/types/with';
import { SessionLucideIconButton } from '../../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { localize } from '../../../../localization/localeTools';

const StyledCommunityInvitation = styled.div`
  background-color: var(--message-bubbles-received-background-color);

  &.invitation-outgoing {
    background-color: var(--message-bubbles-sent-background-color);
    align-self: flex-end;

    .contents {
      .group-details {
        color: var(--message-bubbles-sent-text-color);
      }
      .session-icon-button {
        background-color: var(--transparent-color);
      }
    }
  }

  display: inline-block;
  padding: 4px;
  margin: var(--margins-xs) calc(var(--margins-lg) + var(--margins-md)) 0 var(--margins-lg);

  border-radius: var(--border-radius-message-box);

  align-self: flex-start;

  box-shadow: none;

  .contents {
    display: flex;
    align-items: center;
    margin: 6px;

    .invite-group-avatar {
      height: 48px;
      width: 48px;
    }

    .group-details {
      display: inline-flex;
      flex-direction: column;
      color: var(--message-bubbles-received-text-color);

      padding: 0px 12px;
      .group-name {
        font-weight: bold;
        font-size: 18px;
      }
    }

    .session-icon-button {
      background-color: var(--primary-color);
    }
  }

  cursor: pointer;
`;

const StyledIconContainer = styled.div`
  background-color: var(--message-link-preview-background-color);
  border-radius: 100%;
`;

export const CommunityInvitation = ({ messageId }: WithMessageId) => {
  const messageDirection = useMessageDirection(messageId);
  const classes = ['group-invitation'];

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

  if (messageDirection === 'outgoing') {
    classes.push('invitation-outgoing');
  }

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
        className={clsx(classes)}
        onClick={() => {
          acceptOpenGroupInvitation(fullUrl, communityName);
        }}
      >
        <div className="contents">
          <StyledIconContainer>
            <SessionLucideIconButton
              iconColor={
                messageDirection === 'outgoing'
                  ? 'var(--message-bubbles-sent-text-color)'
                  : 'var(--message-bubbles-received-text-color)'
              }
              unicode={LUCIDE_ICONS_UNICODE.GLOBE}
              iconSize={'large'}
              style={{
                aspectRatio: 1,
                height: '2.5em',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            />
          </StyledIconContainer>
          <span className="group-details">
            <span className="group-name">{communityName}</span>
            <span className="group-type">{localize('communityInvitation').toString()}</span>
            <span className="group-address">{hostname}</span>
          </span>
        </div>
      </StyledCommunityInvitation>
    </ExpirableReadableMessage>
  );
};
