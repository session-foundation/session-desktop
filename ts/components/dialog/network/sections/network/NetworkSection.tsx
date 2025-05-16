import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import type { CSSProperties } from 'styled-components';
import { formatMessageWithArgs, localize } from '../../../../../localization/localeTools';
import { Flex } from '../../../../basic/Flex';
import { SpacerMD, SpacerXS } from '../../../../basic/Text';
import {
  SectionHeading,
  SessionNetworkParagraph,
  Block,
  BlockPrimaryText,
  BlockSecondaryText,
  BlockText,
  SessionNetworkHeading,
} from '../../components';
import { useIsDarkTheme } from '../../../../../state/theme/selectors/theme';
import { Localizer } from '../../../../basic/Localizer';
import { LOCALE_DEFAULTS } from '../../../../../localization/constants';
import { NodeImage } from '../../NodeImage';
import { showLinkVisitWarningDialog } from '../../../OpenUrlModal';
import { useSecuringNodesCount } from './hooks/useSecuringNodesCount';
import { formatNumber, formatDateWithLocale } from '../../../../../util/i18n/formatting/generics';
import { abbreviateNumber } from '../../../../../util/numbers';
import { SessionIconButton } from '../../../../icon';
import { SessionSpinner } from '../../../../loading';
import { SessionTooltip } from '../../../../SessionTooltip';
import { useHTMLDirection } from '../../../../../util/i18n/rtlSupport';
import {
  useUSDPrice,
  useNetworkStakedTokens,
  useNetworkStakedUSD,
  usePriceTimestamp,
} from '../../../../../state/selectors/networkData';
import { Grid } from '../../../../basic/Grid';
import { useIsOnline } from '../../../../../state/selectors/onions';

const StyledStatsNumber = styled.strong`
  font-size: var(--font-size-h3-new);
  color: var(--renderer-span-primary-color);
  line-height: var(--font-line-height);
`;

const NodesStats = ({
  securingNodesCount,
  swarmNodeCount,
  loading,
  error,
  style,
}: {
  securingNodesCount: number | undefined;
  swarmNodeCount: number | undefined;
  loading: boolean;
  error?: Error;
  style?: CSSProperties;
}) => {
  const isOnline = useIsOnline();
  // NOTE We don't want to show the stats or the NodeImage unless we have both count values
  const ready = isOnline && !loading && !error && swarmNodeCount && securingNodesCount;

  return (
    <Flex
      height={'133px'}
      $container={true}
      $flexDirection="column"
      $justifyContent="space-around"
      $alignItems="flex-start"
      style={style}
    >
      <Flex
        $container={true}
        width="100%"
        $justifyContent="space-between"
        $alignItems="center"
        overflowY="hidden"
        height="100%"
        maxHeight="64px"
      >
        <SessionNetworkHeading width="60%">
          <Localizer token={'sessionNetworkNodesSwarm'} />
        </SessionNetworkHeading>
        <StyledStatsNumber data-testid="your-swarm-amount">
          {ready ? swarmNodeCount : <SessionSpinner loading={true} width="64px" height={'64px'} />}
        </StyledStatsNumber>
      </Flex>
      <Flex
        $container={true}
        width="100%"
        $justifyContent="space-between"
        $alignItems="center"
        overflowY="hidden"
        height="100%"
        maxHeight="64px"
        margin="0 0 auto 0"
      >
        <SessionNetworkHeading width="60%">
          <Localizer token={'sessionNetworkNodesSecuring'} />
        </SessionNetworkHeading>
        <StyledStatsNumber data-testid="nodes-securing-amount">
          {ready ? (
            `${abbreviateNumber(securingNodesCount, 0).toUpperCase()}`
          ) : (
            <SessionSpinner loading={true} width="64px" height={'64px'} />
          )}
        </StyledStatsNumber>
      </Flex>
    </Flex>
  );
};

const CurrentPriceBlock = ({
  loading,
  usdPrice,
}: {
  loading: boolean;
  usdPrice: number | null;
}) => {
  const isOnline = useIsOnline();
  const isDarkTheme = useIsDarkTheme();
  const priceTimestamp = usePriceTimestamp();
  const currentPrice = loading
    ? localize('loading')
    : isOnline && usdPrice
      ? `$${formatNumber(usdPrice, { currency: LOCALE_DEFAULTS.usd_name_short, minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}`
      : localize('unavailable').toString();

  return (
    <Block
      $container={true}
      width="100%"
      $flexDirection="row"
      $justifyContent="space-between"
      $alignItems="flex-start"
      paddingInline={'12px 0'}
      paddingBlock={'var(--margins-md)'}
      backgroundColor={isDarkTheme ? undefined : 'var(--background-secondary-color)'}
      borderColor={isDarkTheme ? undefined : 'var(--transparent-color)'}
    >
      <Flex $container={true} $flexDirection="column" $alignItems="flex-start">
        <BlockText>
          <Localizer token={'sessionNetworkCurrentPrice'} />
        </BlockText>
        <SpacerXS />
        <BlockPrimaryText dataTestId={'sent-price'}>
          <b>{currentPrice}</b>
        </BlockPrimaryText>
        <SpacerXS />
        <BlockSecondaryText>{LOCALE_DEFAULTS.token_name_long}</BlockSecondaryText>
      </Flex>
      <SessionTooltip
        content={formatMessageWithArgs(LOCALE_DEFAULTS.session_network_data_price, {
          date_time: !priceTimestamp
            ? '-'
            : formatDateWithLocale({
                date: new Date(priceTimestamp * 1000),
                formatStr: 'd MMM yyyy hh:mm a',
              }),
        })}
        loading={loading}
        dataTestId="tooltip-info"
        htmlString={true}
        style={{
          position: 'absolute',
          top: 'var(--margins-xs)',
          insetInlineEnd: 'var(--margins-xs)',
        }}
      >
        <SessionIconButton
          ariaLabel="Network price explanation tooltip"
          iconType="question"
          iconSize={9}
          iconPadding="2px"
          iconColor="var(--text-primary-color)"
          padding={'0'}
          style={{
            border: '1px solid var(--text-primary-color)',
            borderRadius: '9999px',
          }}
          dataTestId="tooltip"
        />
      </SessionTooltip>
    </Block>
  );
};

const SecuredByBlock = ({
  securedBySESH,
  securedByUSD,
  loading,
}: {
  securedBySESH: number | null;
  securedByUSD: number | null;
  loading: boolean;
}) => {
  const isOnline = useIsOnline();
  const isDarkTheme = useIsDarkTheme();
  const securedAmountSESH = loading
    ? localize('loading')
    : isOnline && securedBySESH
      ? `${abbreviateNumber(securedBySESH, 0).toUpperCase()} ${LOCALE_DEFAULTS.token_name_short}`
      : localize('unavailable').toString();
  const securedAmountUSD = `$${isOnline && !loading && securedByUSD ? formatNumber(securedByUSD, { currency: LOCALE_DEFAULTS.usd_name_short, minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true }) : '-'}`;

  return (
    <Block
      $container={true}
      $flexDirection="column"
      $alignItems="flex-start"
      $flexGrow={1}
      width={'100%'}
      paddingInline={'12px 0'}
      paddingBlock={'var(--margins-md)'}
      backgroundColor={isDarkTheme ? undefined : 'var(--background-secondary-color)'}
      borderColor={isDarkTheme ? undefined : 'var(--transparent-color)'}
    >
      <BlockText>{localize('sessionNetworkSecuredBy')}</BlockText>
      <SpacerXS />
      <BlockPrimaryText dataTestId={'network-secured-amount'}>
        <b>{securedAmountSESH}</b>
      </BlockPrimaryText>
      <SpacerXS />
      <BlockSecondaryText style={{ margin: 'auto 0 0 0' }}>{securedAmountUSD}</BlockSecondaryText>
    </Block>
  );
};

export function NetworkSection({ loading: _loading }: { loading: boolean }) {
  const htmlDirection = useHTMLDirection();
  const dispatch = useDispatch();
  const usdPrice = useUSDPrice();
  const securedBySESH = useNetworkStakedTokens();
  const securedByUSD = useNetworkStakedUSD();
  const {
    securingNodesCount,
    swarmNodeCount,
    error,
    loading: countsLoading,
  } = useSecuringNodesCount();
  const loading = countsLoading || _loading;

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
        {LOCALE_DEFAULTS.network_name}
      </SectionHeading>
      <SessionNetworkParagraph
        interactive={true}
        onClick={() => {
          showLinkVisitWarningDialog('https://docs.getsession.org/session-network', dispatch);
        }}
        data-testid="learn-more-network-link"
      >
        <Localizer
          token={'sessionNetworkDescription'}
          args={{
            icon: 'EXTERNAL_LINK_ICON',
          }}
        />
      </SessionNetworkParagraph>
      <SpacerMD />
      <Grid
        $container={true}
        $gridTemplateColumns="153px 1fr"
        $gridTemplateRows="auto auto"
        $gridGap="var(--margins-md)"
        width="100%"
      >
        <NodeImage
          count={swarmNodeCount ?? 0}
          width={'153px'}
          height={'133px'}
          loading={loading || !swarmNodeCount || !securingNodesCount}
          error={error}
        />
        <NodesStats
          securingNodesCount={securingNodesCount}
          swarmNodeCount={swarmNodeCount}
          loading={loading}
          error={error}
        />
        <CurrentPriceBlock loading={loading} usdPrice={usdPrice} />
        <SecuredByBlock
          securedBySESH={securedBySESH}
          securedByUSD={securedByUSD}
          loading={loading}
        />
      </Grid>
      <SpacerMD />
    </Flex>
  );
}
