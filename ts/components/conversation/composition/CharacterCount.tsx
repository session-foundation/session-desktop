import styled from 'styled-components';
import LIBSESSION_CONSTANTS from '../../../session/utils/libsession/libsession_constants';
import { getFeatureFlagMemo } from '../../../state/ducks/types/releasedFeaturesReduxTypes';
import { SessionTooltip } from '../../SessionTooltip';
import { StyledCTA } from '../../basic/StyledCTA';
import { formatNumber } from '../../../util/i18n/formatting/generics';
import { tr } from '../../../localization/localeTools';
import { useCurrentUserHasPro, useCurrentUserHasProAccess } from '../../../hooks/useHasPro';
import { ProIconButton } from '../../buttons/ProButton';
import { useProBadgeOnClickCb } from '../../menuAndSettingsHooks/useProBadgeOnClickCb';

export type CharacterCountProps = {
  text: string;
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

export function CharacterCount({ text }: CharacterCountProps) {
  const alwaysShowFlag = getFeatureFlagMemo('alwaysShowRemainingChars');

  const codepointCount = [...text].length;

  // How many characters we may send is ACCESS, not DISPLAY: the recipient decides what to keep by
  // validating the proof we attach, so counting against the Pro limit without one would promise an
  // allowance every recipient will truncate. Subscribed rather than called, because this is a render —
  // the send path itself calls the function directly, which is what actually has to be current.
  const currentUserHasProAccess = useCurrentUserHasProAccess();

  const charLimit = currentUserHasProAccess
    ? LIBSESSION_CONSTANTS.MESSAGE_CHARACTER_LIMIT_PRO
    : LIBSESSION_CONSTANTS.MESSAGE_CHARACTER_LIMIT_STANDARD;

  const remaining = charLimit - codepointCount;
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
