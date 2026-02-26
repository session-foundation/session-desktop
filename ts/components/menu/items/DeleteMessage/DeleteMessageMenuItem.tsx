import styled from 'styled-components';
import { isEmpty } from 'lodash';
import useUpdate from 'react-use/lib/useUpdate';
import useInterval from 'react-use/lib/useInterval';
import { useSelectedConversationKey } from '../../../../state/selectors/selectedConversation';
import { MenuItem } from '../MenuItem';
import { tr } from '../../../../localization/localeTools';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { DURATION } from '../../../../session/constants';
import { formatAbbreviatedExpireDoubleTimer } from '../../../../util/i18n/formatting/expirationTimer';
import { useMessageExpirationPropsById } from '../../../../hooks/useParamSelector';
import { useDeleteMessagesCb } from '../../../menuAndSettingsHooks/useDeleteMessagesCb';

const StyledDeleteItemContent = styled.span`
  display: flex;
  flex-direction: row;
`;

const StyledTextContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledExpiresIn = styled.span`
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

  const deleteMessagesCb = useDeleteMessagesCb(convoId);

  if (!deleteMessagesCb || !messageId) {
    return null;
  }

  return (
    <MenuItem
      onClick={() => void deleteMessagesCb(messageId)}
      iconType={LUCIDE_ICONS_UNICODE.TRASH2}
      isDangerAction={true}
    >
      <StyledDeleteItemContent>
        <StyledTextContainer>
          {tr('delete')}
          <ExpiresInItem messageId={messageId} />
        </StyledTextContainer>
      </StyledDeleteItemContent>
    </MenuItem>
  );
};
