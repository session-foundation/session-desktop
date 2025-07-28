import styled from 'styled-components';
import { Constants } from '../../../session';
import { useFeatureFlag } from '../../../state/ducks/types/releasedFeaturesReduxTypes';
import { SessionTooltip } from '../../SessionTooltip';
import { StyledCTA } from '../../basic/StyledCTA';
import {
  SessionProInfoVariant,
  useShowSessionProInfoDialogCb,
} from '../../dialog/SessionProInfoModal';
import { formatNumber } from '../../../util/i18n/formatting/generics';
import { useIsProAvailable } from '../../../hooks/useIsProAvailable';
import { tr } from '../../../localization/localeTools';
import { useCurrentUserHasPro } from '../../../hooks/useHasPro';
import { ProIcon } from '../../buttons/ProButton';

export type CharacterCountProps = {
  count: number;
};

const CHARACTER_SHOW_REMAINING_BUFFER = 200;

const StyledCharacterCountContainer = styled.div`
  font-size: var(--font-size-sm);
  display: flex;
  justify-items: end;
  align-items: end;
  flex-direction: column;
  gap: var(--margins-xs);
  position: absolute;
  top: var(--margins-sm);
  inset-inline-end: var(--margins-md);
`;

const StyledRemainingNumber = styled.span<{ pastLimit: boolean }>`
  color: ${props => (props.pastLimit ? 'var(--danger-color)' : 'var(--text-primary-color)')};
`;

export function CharacterCount({ count }: CharacterCountProps) {
  const alwaysShowFlag = useFeatureFlag('alwaysShowRemainingChars');
  const isProAvailable = useIsProAvailable();

  const hasPro = useCurrentUserHasPro();

  const charLimit = hasPro
    ? Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_PRO
    : Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_STANDARD;

  const remaining = charLimit - count;
  const pastLimit = remaining < 0;

  const handleClick = useShowSessionProInfoDialogCb(SessionProInfoVariant.MESSAGE_CHARACTER_LIMIT);

  return alwaysShowFlag || remaining <= CHARACTER_SHOW_REMAINING_BUFFER ? (
    <StyledCharacterCountContainer>
      {isProAvailable && !hasPro ? (
        <StyledCTA onClick={handleClick}>
          Send more with <ProIcon iconSize={'huge'} />
        </StyledCTA>
      ) : null}
      <SessionTooltip
        horizontalPosition="center"
        verticalPosition="bottom"
        content={tr(pastLimit ? 'remainingCharactersOverTooltip' : 'remainingCharactersTooltip', {
          count: pastLimit ? remaining * -1 : remaining,
        })}
        dataTestId="tooltip-character-count"
      >
        <StyledRemainingNumber pastLimit={pastLimit}>
          {formatNumber(remaining)}
        </StyledRemainingNumber>
      </SessionTooltip>
    </StyledCharacterCountContainer>
  ) : null;
}
