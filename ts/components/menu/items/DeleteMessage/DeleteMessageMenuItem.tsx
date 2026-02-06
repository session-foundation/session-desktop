import styled from 'styled-components';
import { isEmpty } from 'lodash';
import useUpdate from 'react-use/lib/useUpdate';
import useInterval from 'react-use/lib/useInterval';
import {
  useMessageIsDeletable,
  useMessageIsDeletableForEveryone,
} from '../../../../state/selectors';
import {
  useSelectedConversationKey,
  useSelectedIsPublic,
} from '../../../../state/selectors/selectedConversation';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { tr } from '../../../../localization/localeTools';
import { SessionLucideIconButton } from '../../../icon/SessionIconButton';
import { SpacerSM } from '../../../basic/Text';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { DURATION } from '../../../../session/constants';
import { formatAbbreviatedExpireDoubleTimer } from '../../../../util/i18n/formatting/expirationTimer';
import { useMessageExpirationPropsById } from '../../../../hooks/useParamSelector';
import { useMessageInteractions } from '../../../../hooks/useMessageInteractions';

const StyledDeleteItemContent = styled.span`
  color: var(--danger-color);
  display: flex;
  flex-direction: row;
`;

const StyledTextContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledExpiresIn = styled.span`
  color: var(--danger-color);
  font-size: var(--font-size-xs);
`;

function useIsRenderedExpiresInItem(messageId: string) {
  const expiryDetails = useMessageExpirationPropsById(messageId);

  if (
    !expiryDetails ||
    isEmpty(expiryDetails) ||
    !expiryDetails.expirationDurationMs ||
    expiryDetails.isExpired ||
    !expiryDetails.expirationTimestamp
  ) {
    return null;
  }

  return expiryDetails.expirationTimestamp;
}

function formatTimeLeft({ timeLeftMs }: { timeLeftMs: number }) {
  const timeLeftSeconds = Math.floor(timeLeftMs / 1000);

  if (timeLeftSeconds <= 0) {
    return '0s';
  }

  const [time_large, time_small] = formatAbbreviatedExpireDoubleTimer(timeLeftSeconds);
  if (time_large && time_small) {
    return tr('disappearingMessagesCountdownBigSmallMobile', {
      time_large,
      time_small,
    });
  }
  if (time_large) {
    return tr('disappearingMessagesCountdownBigMobile', {
      time_large,
    });
  }

  throw new Error('formatTimeLeft unexpected duration given');
}

const ExpiresInItem = ({ messageId }: { messageId: string }) => {
  // this boolean is just used to forceRefresh the state when we get to display seconds in the contextmenu
  const update = useUpdate();
  const expirationTimestamp = useIsRenderedExpiresInItem(messageId);
  const timeLeftMs = (expirationTimestamp || 0) - Date.now();

  useInterval(
    () => {
      update();
    },
    // We want to force refresh this component a lot more if the message has less than 1h before disappearing,
    // because when that's the case we also display the seconds left (i.e. 59min 23s) and we want that 23s to be dynamic.
    // Also, we use a refresh interval of 500 rather than 1s so that the counter is a bit smoother
    timeLeftMs > 0 && timeLeftMs <= 1 * DURATION.HOURS ? 500 : null
  );
  if (!expirationTimestamp || timeLeftMs < 0) {
    return null;
  }

  return <StyledExpiresIn>{formatTimeLeft({ timeLeftMs })}</StyledExpiresIn>;
};

export const DeleteItem = ({ messageId }: { messageId: string }) => {
  const convoId = useSelectedConversationKey();
  const isPublic = useSelectedIsPublic();

  const isDeletable = useMessageIsDeletable(messageId);
  const isDeletableForEveryone = useMessageIsDeletableForEveryone(messageId);

  const { deleteFromConvo } = useMessageInteractions(messageId);
  const onClick = () => {
    deleteFromConvo(isPublic, convoId);
  };

  if (!convoId || (isPublic && !isDeletableForEveryone) || (!isPublic && !isDeletable)) {
    return null;
  }

  return (
    <ItemWithDataTestId onClick={onClick}>
      <StyledDeleteItemContent>
        <SessionLucideIconButton
          iconSize="medium"
          iconColor="var(--danger-color)"
          unicode={LUCIDE_ICONS_UNICODE.TRASH2}
        />
        <SpacerSM />
        <StyledTextContainer>
          {tr('delete')}
          <ExpiresInItem messageId={messageId} />
        </StyledTextContainer>
      </StyledDeleteItemContent>
    </ItemWithDataTestId>
  );
};
