import styled from 'styled-components';
import type { SessionDataTestId } from 'react';
import { getAppDispatch } from '../../../../../../state/dispatch';
import { SessionNetworkParagraph, SectionHeading, SessionNetworkButton } from '../components';
import { Localizer } from '../../../../../basic/Localizer';
import { Flex } from '../../../../../basic/Flex';
import { SessionButtonColor, SessionButtonShape } from '../../../../../basic/SessionButton';
import { SpacerXS } from '../../../../../basic/Text';
import { showLinkVisitWarningDialog } from '../../../../OpenUrlModal';
import { formatNumber } from '../../../../../../util/i18n/formatting/generics';
import { useIsDarkTheme } from '../../../../../../state/theme/selectors/theme';
import { useHTMLDirection } from '../../../../../../util/i18n/rtlSupport';
import {
  useDataIsStale,
  useStakingRewardPool,
  useUSDMarketCap,
} from '../../../../../../state/selectors/networkData';
import {
  useInfoFakeRefreshing,
  useInfoLoading,
} from '../../../../../../state/selectors/networkModal';
import { tEnglish, tr } from '../../../../../../localization/localeTools';

const StyledTokenSection = styled(Flex)<{ $loading: boolean }>`
  font-size: var(--font-display-size-lg);
  padding: var(--margins-lg) 0;
  span {
    width: 50%;
  }

  span:nth-child(2) {
    ${props => (props.$loading ? 'color: var(--text-secondary-color);' : '')};
  }

  &:not(:last-child) {
    border-bottom: 1px solid var(--borders-color);
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
      $loading={loading}
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

export function StakeSection() {
  const htmlDirection = useHTMLDirection();
  const isDarkTheme = useIsDarkTheme();
  const infoLoading = useInfoLoading();

  const stakingRewardPool = useStakingRewardPool();
  const usdMarketCap = useUSDMarketCap();
  const dataIsStale = useDataIsStale();

  const dispatch = getAppDispatch();
  const isFakeRefreshing = useInfoFakeRefreshing();

  const stakingRewardPoolValue =
    stakingRewardPool && !isFakeRefreshing && !dataIsStale
      ? `${formatNumber(stakingRewardPool, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          useGrouping: true,
        })} ${tr('tokenNameShort')}`
      : infoLoading || isFakeRefreshing
        ? tr('loading')
        : tr('unavailable');

  const networkMarketCapValue =
    usdMarketCap && !isFakeRefreshing && !dataIsStale
      ? `$${formatNumber(usdMarketCap, {
          currency: tEnglish('usdNameShort'),
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          useGrouping: true,
        })} ${tr('usdNameShort')}`
      : infoLoading || isFakeRefreshing
        ? tr('loading')
        : tr('unavailable');

  return (
    <Flex
      $container={true}
      dir={htmlDirection}
      width={'100%'}
      $flexDirection={'column'}
      $justifyContent={'flex-start'}
      $alignItems={'center'}
    >
      <SectionHeading $margin={'0 0 var(--margins-xs)'}>{tr('tokenNameLong')}</SectionHeading>
      <SessionNetworkParagraph>
        <Localizer token={'sessionNetworkTokenDescription'} />
      </SessionNetworkParagraph>
      <Flex $container={true} $flexDirection="column" width="100%" $alignItems="center">
        <TokenSection
          text={tr('stakingRewardPool')}
          value={stakingRewardPoolValue}
          loading={infoLoading || !stakingRewardPool || isFakeRefreshing || dataIsStale}
          dataTestId={'staking-reward-pool-amount'}
        />
        <TokenSection
          text={tr('sessionNetworkMarketCap')}
          value={networkMarketCapValue}
          loading={infoLoading || !usdMarketCap || isFakeRefreshing || dataIsStale}
          dataTestId={'market-cap-amount'}
        />
      </Flex>
      <SpacerXS />
      <SessionNetworkButton
        buttonColor={isDarkTheme ? SessionButtonColor.PrimaryDark : undefined}
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
