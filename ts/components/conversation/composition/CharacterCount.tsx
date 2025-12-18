import styled from 'styled-components';
import { Constants } from '../../../session';
import { getFeatureFlagMemo } from '../../../state/ducks/types/releasedFeaturesReduxTypes';
import { SessionTooltip } from '../../SessionTooltip';
import { StyledCTA } from '../../basic/StyledCTA';
import { formatNumber } from '../../../util/i18n/formatting/generics';
import { tr } from '../../../localization/localeTools';
import { useCurrentUserHasPro } from '../../../hooks/useHasPro';
import { ProIconButton } from '../../buttons/ProButton';
import { useProBadgeOnClickCb } from '../../menuAndSettingsHooks/useProBadgeOnClickCb';

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

const StyledRemainingNumber = styled.span<{ $pastLimit: boolean }>`
  color: ${props => (props.$pastLimit ? 'var(--danger-color)' : 'var(--text-primary-color)')};
`;

function ProCta() {
  const currentUserHasPro = useCurrentUserHasPro();

  const proBadgeCb = useProBadgeOnClickCb({
    context: 'character-count',
    args: { currentUserHasPro },
  });

  if (!proBadgeCb.show || !proBadgeCb.cb) {
    return null;
  }

  return (
    <StyledCTA onClick={proBadgeCb.cb}>
      {tr('proSendMore')}{' '}
      <ProIconButton iconSize={'small'} dataTestId="pro-badge-send-more" onClick={proBadgeCb.cb} />
    </StyledCTA>
  );
}

export function CharacterCount({ count }: CharacterCountProps) {
  const alwaysShowFlag = getFeatureFlagMemo('alwaysShowRemainingChars');

  const currentUserHasPro = useCurrentUserHasPro();

  const charLimit = currentUserHasPro
    ? Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_PRO
    : Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_STANDARD;

  const remaining = charLimit - count;
  const pastLimit = remaining < 0;

  return alwaysShowFlag || remaining <= CHARACTER_SHOW_REMAINING_BUFFER ? (
    <StyledCharacterCountContainer>
      <ProCta />
      <SessionTooltip
        horizontalPosition="center"
        verticalPosition="bottom"
        content={tr(pastLimit ? 'remainingCharactersOverTooltip' : 'remainingCharactersTooltip', {
          count: pastLimit ? remaining * -1 : remaining,
        })}
        dataTestId="tooltip-character-count"
      >
        <StyledRemainingNumber $pastLimit={pastLimit}>
          {formatNumber(remaining)}
        </StyledRemainingNumber>
      </SessionTooltip>
    </StyledCharacterCountContainer>
  ) : null;
}
