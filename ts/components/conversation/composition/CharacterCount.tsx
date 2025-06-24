import styled from 'styled-components';
// import { useDispatch } from 'react-redux';
import { Constants } from '../../../session';
import { Localizer } from '../../basic/Localizer';
import { getFeatureFlag } from '../../../state/ducks/types/releasedFeaturesReduxTypes';
import { SessionTooltip } from '../../SessionTooltip';
// TODO: uncomment with pro
// import { StyledCTA } from '../../cta/StyledCTA';
// import { Localizer } from '../../basic/Localizer';
// import { LOCALE_DEFAULTS } from '../../../localization/constants';
// import { SessionProInfoVariant, showSessionProInfoDialog } from '../../dialog/SessionProInfoModal';
// import { getFeatureFlag } from '../../../state/ducks/types/releasedFeaturesReduxTypes';

export type CharacterCountProps = {
  count: number;
};

const CHARACTER_SHOW_REMAINING_BUFFER = 200;

const StyledCharacterCountContainer = styled.div`
  display: flex;
  justify-items: end;
  align-items: end;
  flex-direction: column;
  gap: var(--margins-xs);
  position: absolute;
  top: var(--margins-sm);
  inset-inline-end: var(--margins-lg);
`;

const StyledRemainingNumber = styled.span<{ pastLimit: boolean }>`
  color: ${props => (props.pastLimit ? 'var(--danger-color)' : 'var(--text-primary-color)')};
`;

export function CharacterCount({ count }: CharacterCountProps) {
  const alwaysShowFlag = getFeatureFlag('useAlwaysShowRemainingChars');
  // TODO: implement with pro
  // const dispatch = useDispatch();
  // const isProAvailable = getFeatureFlag('useProAvailable');
  // const mockHasPro = getFeatureFlag('useMockUserHasPro');

  // TODO: get pro status from store once available
  // const hasPro = mockHasPro;
  // const charLimit = hasPro
  //   ? Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_PRO
  //   : Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_STANDARD;
  const charLimit = Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT;

  const remaining = charLimit - count;
  const pastLimit = remaining < 0;

  // TODO: implement with pro
  // const handleClick = () => {
  //   const variant = hasPro
  //     ? SessionProInfoVariant.MESSAGE_TOO_LONG
  //     : SessionProInfoVariant.MESSAGE_TOO_LONG_CTA;
  //
  //   showSessionProInfoDialog(
  //     isProAvailable ? variant : SessionProInfoVariant.MESSAGE_TOO_LONG,
  //     dispatch
  //   );
  // };

  return alwaysShowFlag || remaining <= CHARACTER_SHOW_REMAINING_BUFFER ? (
    <StyledCharacterCountContainer>
      {/* TODO: implement with pro */}
      {/* {isProAvailable && !hasPro ? ( */}
      {/*  <StyledCTA onClick={handleClick}> */}
      {/*    <Localizer token="ctaMessageTooLong" /> */}
      {/*  </StyledCTA> */}
      {/* ) : null} */}
      <SessionTooltip
        horizontalPosition="center"
        verticalPosition="bottom"
        content={
          pastLimit ? (
            <Localizer token="remainingCharactersOverTooltip" args={{ count: remaining * -1 }} />
          ) : (
            <Localizer token="remainingCharactersTooltip" args={{ count: remaining }} />
          )
        }
        dataTestId="tooltip-character-count"
      >
        <div>
          <StyledRemainingNumber pastLimit={pastLimit}>{remaining}</StyledRemainingNumber>
        </div>
      </SessionTooltip>
    </StyledCharacterCountContainer>
  ) : null;
}
