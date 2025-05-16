import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import type { SessionDataTestId } from 'react';
import { SessionNetworkParagraph, SectionHeading, SessionNetworkButton } from '../components';
import { LOCALE_DEFAULTS } from '../../../../localization/constants';
import { Localizer } from '../../../basic/Localizer';
import { Flex } from '../../../basic/Flex';
import { localize } from '../../../../localization/localeTools';
import { SessionButtonColor, SessionButtonShape } from '../../../basic/SessionButton';
import { SpacerXS } from '../../../basic/Text';
import { showLinkVisitWarningDialog } from '../../OpenUrlModal';
import { formatNumber } from '../../../../util/i18n/formatting/generics';
import { useIsDarkTheme } from '../../../../state/theme/selectors/theme';
import { useHTMLDirection } from '../../../../util/i18n/rtlSupport';
import { useStakingRewardPool, useUSDMarketCap } from '../../../../state/selectors/networkData';
import { useIsOnline } from '../../../../state/selectors/onions';

const StyledTokenSection = styled(Flex)<{ loading: boolean }>`
  font-size: var(--font-display-size-lg);
  padding: var(--margins-lg) 0;
  span {
    width: 50%;
  }

  span:nth-child(2) {
    ${props => (props.loading ? 'color: var(--text-secondary-color);' : '')};
  }

  &:not(:last-child) {
    border-bottom: 1px solid var(--border-color);
  }
`;

const TokenSection = ({
  text,
  value,
  loading,
  dataTestId,
}: {
  text: string;
  value: string;
  loading: boolean;
  dataTestId?: SessionDataTestId;
}) => {
  return (
    <StyledTokenSection
      loading={loading}
      $container={true}
      width={'100%'}
      $flexWrap="wrap"
      $alignItems="center"
    >
      <span>
        <b>{text}</b>
      </span>
      <span data-testid={dataTestId}>{value}</span>
    </StyledTokenSection>
  );
};

export function StakeSection({ loading }: { loading: boolean }) {
  const isOnline = useIsOnline();
  const htmlDirection = useHTMLDirection();
  const isDarkTheme = useIsDarkTheme();

  const stakingRewardPool = useStakingRewardPool();
  const usdMarketCap = useUSDMarketCap();

  const dispatch = useDispatch();

  const stakingRewardPoolValue = loading
    ? localize('loading').toString()
    : isOnline && stakingRewardPool
      ? `${formatNumber(stakingRewardPool, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          useGrouping: true,
        })} ${LOCALE_DEFAULTS.token_name_short}`
      : localize('unavailable').toString();

  const networkMarketCapValue = loading
    ? localize('loading').toString()
    : isOnline && usdMarketCap
      ? `$${formatNumber(usdMarketCap, {
          currency: LOCALE_DEFAULTS.usd_name_short,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          useGrouping: true,
        })}`
      : localize('unavailable').toString();

  return (
    <Flex
      $container={true}
      dir={htmlDirection}
      width={'100%'}
      $flexDirection={'column'}
      $justifyContent={'flex-start'}
      $alignItems={'center'}
    >
      <SectionHeading margin={'0 0 var(--margins-xs)'}>
        {LOCALE_DEFAULTS.token_name_long}
      </SectionHeading>
      <SessionNetworkParagraph>
        <Localizer token={'sessionNetworkTokenDescription'} />
      </SessionNetworkParagraph>
      <Flex $container={true} $flexDirection="column" width="100%" $alignItems="center">
        <TokenSection
          text={LOCALE_DEFAULTS.staking_reward_pool}
          value={stakingRewardPoolValue}
          loading={loading || !stakingRewardPool}
          dataTestId={'staking-reward-pool-amount'}
        />
        <TokenSection
          text={localize('sessionNetworkMarketCap').toString()}
          value={networkMarketCapValue}
          loading={loading || !usdMarketCap}
          dataTestId={'market-cap-amount'}
        />
      </Flex>
      <SpacerXS />
      <SessionNetworkButton
        buttonColor={isDarkTheme ? SessionButtonColor.Primary : undefined}
        buttonShape={SessionButtonShape.Square}
        onClick={() => {
          showLinkVisitWarningDialog(
            'https://docs.getsession.org/session-network/staking',
            dispatch
          );
        }}
        dataTestId="learn-about-staking-link"
      >
        <Localizer token={'sessionNetworkLearnAboutStaking'} />
      </SessionNetworkButton>
    </Flex>
  );
}
