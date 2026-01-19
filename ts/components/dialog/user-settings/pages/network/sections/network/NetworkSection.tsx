/* eslint-disable no-unneeded-ternary */
import styled from 'styled-components';
import type { CSSProperties } from 'styled-components';
import { useMemo } from 'react';
import { getAppDispatch } from '../../../../../../../state/dispatch';
import { tEnglish, tr } from '../../../../../../../localization/localeTools';
import { Flex } from '../../../../../../basic/Flex';
import { SpacerMD, SpacerXS } from '../../../../../../basic/Text';
import {
  SectionHeading,
  SessionNetworkParagraph,
  Block,
  BlockPrimaryText,
  BlockSecondaryText,
  BlockText,
  SessionNetworkHeading,
} from '../../components';
import { useIsDarkTheme } from '../../../../../../../state/theme/selectors/theme';
import { Localizer } from '../../../../../../basic/Localizer';
import { NodeImage } from '../../NodeImage';
import { showLinkVisitWarningDialog } from '../../../../../OpenUrlModal';
import { useSecuringNodesCount } from './hooks/useSecuringNodesCount';
import {
  formatNumber,
  formatDateWithLocale,
} from '../../../../../../../util/i18n/formatting/generics';
import { abbreviateNumber } from '../../../../../../../util/numbers';
import { useHTMLDirection } from '../../../../../../../util/i18n/rtlSupport';
import {
  usePriceTimestamp,
  useDataIsStale,
  useNetworkStakedUSD,
  useNetworkStakedTokens,
  useUSDPrice,
} from '../../../../../../../state/selectors/networkData';
import { Grid } from '../../../../../../basic/Grid';
import {
  useInfoFakeRefreshing,
  useInfoLoading,
} from '../../../../../../../state/selectors/networkModal';
import { SessionLucideIconButton } from '../../../../../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../../../../../icon/lucide';
import { SessionTooltip } from '../../../../../../SessionTooltip';
import { AnimatedSpinnerIcon } from '../../../../../../loading/spinner/AnimatedSpinnerIcon';

const StyledStatsNumber = styled.strong`
  font-size: var(--font-size-h3-new);
  color: var(--renderer-span-primary-color);
  line-height: var(--font-line-height);
`;

const NodesStats = ({ style }: { style?: CSSProperties }) => {
  const { securingNodesCount, swarmNodeCount, dataIsStale } = useSecuringNodesCount();
  const isFakeRefreshing = useInfoFakeRefreshing();

  const infoLoading = useInfoLoading();

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
        $overflowY="hidden"
        height="100%"
        $maxHeight="64px"
      >
        <SessionNetworkHeading width="60%">
          <Localizer token={'sessionNetworkNodesSwarm'} />
        </SessionNetworkHeading>
        <StyledStatsNumber data-testid="your-swarm-amount">
          {!infoLoading &&
          !dataIsStale &&
          !isFakeRefreshing &&
          securingNodesCount &&
          swarmNodeCount ? (
            swarmNodeCount
          ) : (
            <AnimatedSpinnerIcon size="huge" />
          )}
        </StyledStatsNumber>
      </Flex>
      <Flex
        $container={true}
        width="100%"
        $justifyContent="space-between"
        $alignItems="center"
        $overflowY="hidden"
        height="100%"
        $maxHeight="64px"
        $margin="0 0 auto 0"
      >
        <SessionNetworkHeading width="60%">
          <Localizer token={'sessionNetworkNodesSecuring'} />
        </SessionNetworkHeading>
        <StyledStatsNumber data-testid="nodes-securing-amount">
          {!dataIsStale && securingNodesCount && !isFakeRefreshing ? (
            `${abbreviateNumber(securingNodesCount, 0).toUpperCase()}`
          ) : (
            <AnimatedSpinnerIcon size="huge" />
          )}
        </StyledStatsNumber>
      </Flex>
    </Flex>
  );
};

const CurrentPriceBlock = () => {
  const isDarkTheme = useIsDarkTheme();
  const priceTimestamp = usePriceTimestamp();
  const usdPrice = useUSDPrice();
  const infoLoading = useInfoLoading();
  const isFakeRefreshing = useInfoFakeRefreshing();
  const dataIsStale = useDataIsStale();

  // if we have usdPrice (and not stale), we can show it
  const currentPrice =
    usdPrice && !isFakeRefreshing && !dataIsStale
      ? `$${formatNumber(usdPrice, { currency: tEnglish('usdNameShort'), minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })} ${tEnglish('usdNameShort')}`
      : infoLoading || isFakeRefreshing
        ? tr('loading')
        : tr('unavailable');

  const tooltipContent = useMemo(
    () => (
      <Localizer
        token="sessionNetworkDataPrice"
        date_time={
          priceTimestamp
            ? formatDateWithLocale({
                date: new Date(priceTimestamp * 1000),
                formatStr: 'd MMM yyyy hh:mm a',
              })
            : '-'
        }
      />
    ),
    [priceTimestamp]
  );

  return (
    <Block
      $container={true}
      width="100%"
      $flexDirection="row"
      $justifyContent="space-between"
      $alignItems="flex-start"
      $paddingInline={'12px 0'}
      $paddingBlock={'var(--margins-md)'}
      $backgroundColor={
        isDarkTheme ? 'var(--background-primary-color)' : 'var(--background-secondary-color)'
      }
      $borderColor={'var(--transparent-color)'}
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
        <BlockSecondaryText>{tr('tokenNameLong')}</BlockSecondaryText>
      </Flex>
      <SessionTooltip
        content={tooltipContent}
        loading={infoLoading || isFakeRefreshing || dataIsStale}
        dataTestId="tooltip-info"
        style={{
          position: 'absolute',
          top: '1px',
          right: '1px',
        }}
      >
        <SessionLucideIconButton
          ariaLabel="Network price explanation tooltip"
          unicode={LUCIDE_ICONS_UNICODE.CIRCLE_HELP}
          iconColor="var(--text-primary-color)"
          iconSize="small"
          dataTestId="tooltip"
        />
      </SessionTooltip>
    </Block>
  );
};

const SecuredByBlock = () => {
  const securedBySESH = useNetworkStakedTokens();
  const securedByUSD = useNetworkStakedUSD();
  const dataIsStale = useDataIsStale();
  const isDarkTheme = useIsDarkTheme();
  const infoLoading = useInfoLoading();
  const isFakeRefreshing = useInfoFakeRefreshing();

  const securedAmountSESH =
    securedBySESH && !isFakeRefreshing && !dataIsStale
      ? `${abbreviateNumber(securedBySESH, 0).toUpperCase()} ${tr('tokenNameShort')}`
      : infoLoading || isFakeRefreshing
        ? tr('loading')
        : tr('unavailable');

  const formattedNumberOrFallback =
    securedByUSD && !isFakeRefreshing && !dataIsStale
      ? formatNumber(securedByUSD, {
          currency: tEnglish('usdNameShort'),
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          useGrouping: true,
        })
      : '-';
  const securedAmountUSD = `$${formattedNumberOrFallback} ${tr('usdNameShort')}`;

  return (
    <Block
      $container={true}
      $flexDirection="column"
      $alignItems="flex-start"
      $flexGrow={1}
      width={'100%'}
      $paddingInline={'12px 0'}
      $paddingBlock={'var(--margins-md)'}
      $backgroundColor={
        isDarkTheme ? 'var(--background-primary-color)' : 'var(--background-secondary-color)'
      }
      $borderColor={'var(--transparent-color)'}
    >
      <BlockText>{tr('sessionNetworkSecuredBy')}</BlockText>
      <SpacerXS />
      <BlockPrimaryText dataTestId={'network-secured-amount'}>
        <b>{securedAmountSESH}</b>
      </BlockPrimaryText>
      <SpacerXS />
      <BlockSecondaryText style={{ margin: 'auto 0 0 0' }}>{securedAmountUSD}</BlockSecondaryText>
    </Block>
  );
};

export function NetworkSection() {
  const htmlDirection = useHTMLDirection();
  const dispatch = getAppDispatch();

  return (
    <Flex
      $container={true}
      dir={htmlDirection}
      width={'100%'}
      $flexDirection={'column'}
      $justifyContent={'flex-start'}
      $alignItems={'center'}
    >
      <SectionHeading $margin={'0 0 var(--margins-xs)'}>{tr('networkName')}</SectionHeading>
      <SessionNetworkParagraph
        $interactive={true}
        onClick={() => {
          showLinkVisitWarningDialog('https://docs.getsession.org/session-network', dispatch);
        }}
        data-testid="learn-more-network-link"
      >
        <Localizer
          token={'sessionNetworkDescription'}
          icon={LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON}
          asTag="span"
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
        <NodeImage />
        <NodesStats />
        <CurrentPriceBlock />
        <SecuredByBlock />
      </Grid>
      <SpacerMD />
    </Flex>
  );
}
