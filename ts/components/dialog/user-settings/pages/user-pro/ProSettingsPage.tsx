import { isNumber } from 'lodash';
import {
  MouseEventHandler,
  SessionDataTestId,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import useUpdate from 'react-use/lib/useUpdate';
import styled from 'styled-components';
import { getAppDispatch } from '../../../../../state/dispatch';
import { ModalBasicHeader } from '../../../../SessionWrapperModal';
import { useUserSettingsBackAction, useUserSettingsCloseAction } from '../userSettingsHooks';
import {
  LocalizedPopupDialogButtonOptions,
  updateLocalizedPopupDialog,
  userSettingsModal,
} from '../../../../../state/ducks/modalDialog';
import { ModalBackButton } from '../../../shared/ModalBackButton';
import { UserSettingsModalContainer } from '../../components/UserSettingsModalContainer';
import { ModalFlexContainer } from '../../../shared/ModalFlexContainer';
import {
  PanelButtonGroup,
  PanelLabelWithDescription,
  StyledContent,
  StyledPanelButton,
} from '../../../../buttons/panel/PanelButton';
import { SettingsExternalLinkBasic } from '../../components/SettingsExternalLinkBasic';
import { showLinkVisitWarningDialog } from '../../../OpenUrlModal';
import { PanelIconButton, PanelIconLucideIcon } from '../../../../buttons/panel/PanelIconButton';
import { LUCIDE_ICONS_UNICODE, type WithLucideUnicode } from '../../../../icon/lucide';
import { SettingsChevronBasic } from '../../components/SettingsChevronBasic';
import { SettingsToggleBasic } from '../../components/SettingsToggleBasic';
import { SessionTooltip } from '../../../../SessionTooltip';
import { tr, type TrArgs } from '../../../../../localization/localeTools';
import { LucideIcon } from '../../../../icon/LucideIcon';
import { Storage } from '../../../../../util/storage';
import { SettingsKey } from '../../../../../data/settings-key';
import { SessionIcon } from '../../../../icon';
import { ProIconButton } from '../../../../buttons/ProButton';
import { useIsDarkTheme } from '../../../../../state/theme/selectors/theme';
import { Flex } from '../../../../basic/Flex';
import { Localizer } from '../../../../basic/Localizer';
import {
  useCurrentUserHasPro,
  useCurrentUserHasExpiredPro,
  useCurrentNeverHadPro,
} from '../../../../../hooks/useHasPro';
import { SessionButton, SessionButtonColor } from '../../../../basic/SessionButton';
import { proButtonProps } from '../../../SessionCTA';
import { getIsProGroupsAvailableMemo } from '../../../../../hooks/useIsProAvailable';
import { SpacerMD } from '../../../../basic/Text';
import LIBSESSION_CONSTANTS from '../../../../../session/utils/libsession/libsession_constants';
import { getDataFeatureFlagMemo } from '../../../../../state/ducks/types/releasedFeaturesReduxTypes';
import { AnimatedSpinnerIcon } from '../../../../loading/spinner/AnimatedSpinnerIcon';
import {
  getCachedUserConfig,
  UserConfigWrapperActions,
} from '../../../../../webworker/workers/browser/libsession/libsession_worker_userconfig_interface';
import {
  ProFeatures as ProFeaturesFinder,
  ProMessageFeature,
} from '../../../../../models/proMessageFeature';
import { usePinnedConversationsCount } from '../../../../../state/selectors/conversations';
import {
  useProBackendProStatus,
  useProBackendRefetch,
} from '../../../../../state/selectors/proBackendData';
import { formatNumber } from '../../../../../util/i18n/formatting/generics';
import { NetworkTime } from '../../../../../util/NetworkTime';
import { DURATION } from '../../../../../session/constants';
import { proBackendDataActions } from '../../../../../state/ducks/proBackendData';

type ProSettingsModalState = {
  fromCTA?: boolean;
  returnToThisModalAction: () => void;
  afterCloseAction?: () => void;
  centerAlign?: boolean;
};

type SectionProps = {
  state: ProSettingsModalState;
};

const SectionFlexContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;

const HeroImageBgContainer = styled.div`
  height: 240px;
  align-items: center;
`;

const HeroImageBg = styled.div<{ $noColors?: boolean }>`
  padding-top: 55px;
  justify-items: center;
  text-align: center;

  &::before {
    content: '';
    position: absolute;
    top: 20%;
    left: -40%;
    width: 180%;
    height: 80%;
    background: radial-gradient(
      circle,
      color-mix(
          in srgb,
          ${props => (props.$noColors ? 'var(--disabled-color) 35%' : 'var(--primary-color) 25%')},
          transparent
        )
        0%,
      transparent 70%
    );
    filter: blur(35px);

    z-index: -1; /* behind the logo */
  }
`;

const HeroImageLabelContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--margins-sm);
  padding: var(--margins-md);

  img:first-child {
    transition: var(--duration-session-logo-text);
    filter: var(--session-logo-text-current-filter);
    -webkit-user-drag: none;
  }
`;

export const StyledProStatusText = styled.div<{ $isError?: boolean }>`
  text-align: center;
  font-size: var(--font-size-sm);
  ${props => (props.$isError ? 'color: var(--warning-color);' : '')}
`;

export const StyledProHeroText = styled.div`
  text-align: center;
  font-size: var(--font-size-md);
`;

type ProHeroImageProps = {
  noColors?: boolean;
  isError?: boolean;
  heroStatusText?: ReactNode;
  heroText?: ReactNode;
  onClick?: MouseEventHandler<HTMLDivElement>;
};

export function ProHeroImage({
  noColors,
  isError,
  heroStatusText,
  heroText,
  onClick,
}: ProHeroImageProps) {
  return (
    <SectionFlexContainer onClick={onClick}>
      <SectionFlexContainer style={{ position: 'relative' }}>
        <HeroImageBgContainer>
          <HeroImageBg $noColors={noColors}>
            <SessionIcon
              iconType="brand"
              iconColor={noColors ? 'var(--disabled-color)' : 'var(--primary-color)'}
              iconSize={132}
            />
            {/** We force LTR here as we always want the title to read "Session PRO" */}
            <HeroImageLabelContainer dir="ltr">
              <img src="images/session/session-text.svg" alt="full-brand-text" height={22} />
              <ProIconButton
                iconSize="large"
                dataTestId="invalid-data-testid"
                noColors={noColors}
              />
            </HeroImageLabelContainer>
          </HeroImageBg>
        </HeroImageBgContainer>
      </SectionFlexContainer>
      {heroStatusText ? (
        <StyledProStatusText $isError={isError} data-testid="pro-settings-status-banner">
          {heroStatusText}
        </StyledProStatusText>
      ) : null}
      {heroStatusText && heroText ? <SpacerMD /> : null}
      {heroText ? <StyledProHeroText>{heroText}</StyledProHeroText> : null}
    </SectionFlexContainer>
  );
}

function useBackendErrorDialogButtons() {
  const dispatch = getAppDispatch();
  const refetch = useProBackendRefetch();

  const buttons = useMemo(() => {
    return [
      {
        label: { token: 'retry' },
        dataTestId: 'pro-backend-error-retry-button',
        // Trigger #5, a manual retry: one of the two sanctioned `immediate` callers. Wrapped rather
        // than passed as `onClick: refetch` so the click event isn't handed over as the options arg.
        onClick: () => refetch({ immediate: true }),
        closeAfterClick: true,
      },
      {
        label: { token: 'helpSupport' },
        dataTestId: 'pro-backend-error-support-button',
        onClick: () => {
          showLinkVisitWarningDialog(
            LIBSESSION_CONSTANTS.LIBSESSION_PRO_URLS.support_url,
            dispatch
          );
        },
        closeAfterClick: true,
      },
    ] satisfies Array<LocalizedPopupDialogButtonOptions>;
  }, [dispatch, refetch]);

  return buttons;
}

// NOTE: [react-compiler] this convinces the compiler the hook is static
const useProBackendProStatusInternal = useProBackendProStatus;
const useCurrentUserHasProInternal = useCurrentUserHasPro;
const useCurrentUserHasExpiredProInternal = useCurrentUserHasExpiredPro;
const useCurrentNeverHadProInternal = useCurrentNeverHadPro;
const useIsDarkThemeInternal = useIsDarkTheme;
const usePinnedConversationsCountInternal = usePinnedConversationsCount;

// Trigger #4's cadence (a cross-client contract, see the constants in ducks/proBackendData.ts).
/** How long past the `user_expiry` crossing to wait before the first refetch. */
const GRACE_POLL_CROSSING_SLACK_MS = 5 * DURATION.SECONDS;
/** Then re-check on this cadence while still un-renewed. Equal to STATUS_FLOOR_MS by design, which
 * is why #4 must bypass the floor rather than be halved by it. */
const GRACE_POLL_INTERVAL_MS = 1 * DURATION.MINUTES;

// Extracted into its own hook so the react compiler compiles a small, clean function rather than
// choking on a raw useEffect inside the large ProSettings component.
function useKeepProStatusFresh({
  expiryTimeMs,
  coverageEndMs,
  autoRenew,
  userHasExpiredPro,
  isLoading,
  isError,
}: {
  expiryTimeMs: number;
  coverageEndMs: number;
  autoRenew: boolean;
  userHasExpiredPro: boolean;
  isLoading: boolean;
  isError: boolean;
}) {
  // Keep get_pro_status fresh around the payment-due instant while the pro page is open, so the "renewal
  // unsuccessful" warning reflects reality rather than a pre-expiry snapshot. Without it, a renewal
  // that lands while the page is open isn't picked up until the page is closed and reopened.
  useEffect(() => {
    if (isLoading || isError || userHasExpiredPro || !autoRenew || !expiryTimeMs) {
      return undefined;
    }
    // Floor-exempt because its 60s interval would otherwise sit exactly on the 60s floor and be dropped
    // about half the time.
    //
    // The exemption and the `autoRenew` guard above are a pair: the guard is what bounds this, and being
    // unfloored is what makes an unbounded version expensive. Without it a lapsed non-renewing
    // subscription polls every 60s, floor-exempt, for as long as the page is open. The coverage-end
    // (`E + G`) bound below is that independent lifetime bound: the poll stops when the grace window
    // closes rather than running for as long as the page stays open, matching Android/iOS, which bound
    // their while-open poll at coverage end rather than leaning on `userHasExpiredPro` flipping.
    const fire = () =>
      window.inboxStore?.dispatch(
        proBackendDataActions.refreshGetProStatusFromProBackend({ immediate: true }) as any
      );
    const now = NetworkTime.now();
    // Nothing left to catch once coverage has ended, so never arm past it.
    if (now >= coverageEndMs) {
      return undefined;
    }
    const msUntilExpiry = expiryTimeMs - now;
    if (msUntilExpiry > 0) {
      // Refetch just after the crossing, so a renewal (or a genuine failure) replaces the stale value.
      const timeoutId = setTimeout(fire, msUntilExpiry + GRACE_POLL_CROSSING_SLACK_MS);
      return () => clearTimeout(timeoutId);
    }
    // In the grace window [E, E+G): the renewal can succeed at any point, so re-check until
    // get_pro_status reports the new expiry (the deps change re-arms this) or coverage ends, whichever
    // comes first. The interval clears itself at coverage end so it can never outlive the grace window.
    const intervalId = setInterval(() => {
      if (NetworkTime.now() >= coverageEndMs) {
        clearInterval(intervalId);
        return;
      }
      fire();
    }, GRACE_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [expiryTimeMs, coverageEndMs, autoRenew, userHasExpiredPro, isLoading, isError]);
}

function ProNonProContinueButton({ state }: SectionProps) {
  const { returnToThisModalAction, centerAlign, afterCloseAction } = state;
  const dispatch = getAppDispatch();
  const neverHadPro = useCurrentNeverHadProInternal();
  const { isLoading, isError } = useProBackendProStatusInternal();

  const backendErrorButtons = useBackendErrorDialogButtons();

  const handleClick = () => {
    dispatch(
      isError
        ? updateLocalizedPopupDialog({
            title: { token: 'proStatusError' },
            description: { token: 'proStatusNetworkErrorContinue' },
            overrideButtons: backendErrorButtons,
          })
        : isLoading
          ? updateLocalizedPopupDialog({
              title: { token: 'checkingProStatus' },
              description: { token: 'checkingProStatusContinue' },
            })
          : userSettingsModal({
              userSettingsPage: 'proNonOriginating',
              nonOriginatingVariant: neverHadPro ? 'upgrade' : 'renew',
              overrideBackAction: returnToThisModalAction,
              afterCloseAction,
              centerAlign,
            })
    );
  };

  return (
    <SessionButton
      {...proButtonProps}
      buttonColor={isLoading || isError ? SessionButtonColor.Disabled : SessionButtonColor.Primary}
      onClick={handleClick}
      dataTestId="pro-open-platform-website-button"
    >
      <Localizer token="theContinue" />
    </SessionButton>
  );
}

const StatsContainer = styled.div``;

const StatsRowContainer = styled.div`
  display: flex;
  gap: var(--margins-sm);
  padding: var(--margins-md);
`;

const StatsItemContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--margins-sm);
  align-items: center;
  flex-direction: row;
  width: 50%;
`;

const StatsLabel = styled.div<{ disabled?: boolean }>`
  font-size: var(--font-size-md);
  color: ${props => (props.disabled ? 'var(--disabled-color)' : 'var(--text-primary-color)')};
  font-weight: 700;
  cursor: default;
`;

const proBoxShadow = '0 4px 4px 0 rgba(0, 0, 0, 0.25)';
const proBoxShadowSmall = '0 4px 4px 0 rgba(0, 0, 0, 0.15)';

function formatProStats(v: number) {
  return formatNumber(v, {
    notation: 'compact',
    compactDisplay: 'short', // Uses 'K', 'M', 'B' etc.
  }).toLocaleLowerCase();
}

function ProStats() {
  const mockProLongerMessagesSent = getDataFeatureFlagMemo('mockProLongerMessagesSent');
  const mockProPinnedConversations = getDataFeatureFlagMemo('mockProPinnedConversations');
  const mockProBadgesSent = getDataFeatureFlagMemo('mockProBadgesSent');
  const mockProGroupsUpgraded = getDataFeatureFlagMemo('mockProGroupsUpgraded');

  const pinnedConversations = usePinnedConversationsCountInternal();

  const proLongerMessagesSent =
    mockProLongerMessagesSent ?? (Storage.get(SettingsKey.proLongerMessagesSent) || 0);
  const proBadgesSent = mockProBadgesSent ?? (Storage.get(SettingsKey.proBadgesSent) || 0);
  // those 2 are not a counter, but live based on what is stored libsession/db
  const proPinnedConversations = mockProPinnedConversations ?? (pinnedConversations || 0);
  const proGroupsUpgraded = mockProGroupsUpgraded || 0;

  const isDarkTheme = useIsDarkThemeInternal();

  const proGroupsAvailable = getIsProGroupsAvailableMemo();

  const userHasPro = useCurrentUserHasProInternal();
  if (!userHasPro) {
    return null;
  }

  if (
    !isNumber(proBadgesSent) ||
    !isNumber(proPinnedConversations) ||
    !isNumber(proLongerMessagesSent) ||
    !isNumber(proGroupsUpgraded)
  ) {
    return null;
  }

  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription
        title={{ token: 'proStats' }}
        dataTestId="pro-settings-stats-header"
        extraInlineNode={
          <SessionTooltip
            content={tr('proStatsTooltip')}
            maxContentWidth={'300px'}
            style={{ textAlign: 'center' }}
          >
            <LucideIcon iconSize="small" unicode={LUCIDE_ICONS_UNICODE.CIRCLE_HELP} />
          </SessionTooltip>
        }
      />
      <PanelButtonGroup
        style={
          !isDarkTheme
            ? {
                boxShadow: proBoxShadow,
              }
            : undefined
        }
      >
        <StatsContainer>
          <StatsRowContainer>
            <StatsItemContainer>
              <LucideIcon
                iconColor="var(--primary-color)"
                iconSize="huge"
                unicode={LUCIDE_ICONS_UNICODE.MESSAGE_SQUARE}
              />
              <StatsLabel>
                {tr('proLongerMessagesSent', {
                  count: proLongerMessagesSent,
                  total: formatProStats(proLongerMessagesSent),
                })}
              </StatsLabel>
            </StatsItemContainer>
            <StatsItemContainer>
              <LucideIcon
                iconColor="var(--primary-color)"
                iconSize="huge"
                unicode={LUCIDE_ICONS_UNICODE.PIN}
              />
              <StatsLabel>
                {tr('proPinnedConversations', {
                  count: proPinnedConversations,
                  total: formatProStats(proPinnedConversations),
                })}
              </StatsLabel>
            </StatsItemContainer>
          </StatsRowContainer>
          <StatsRowContainer>
            <StatsItemContainer>
              <LucideIcon
                iconColor="var(--primary-color)"
                iconSize="huge"
                unicode={LUCIDE_ICONS_UNICODE.RECTANGLE_ELLIPSES}
              />
              <StatsLabel>
                {tr('proBadgesSent', {
                  count: proBadgesSent,
                  total: formatProStats(proBadgesSent),
                })}
              </StatsLabel>
            </StatsItemContainer>
            <StatsItemContainer>
              <LucideIcon
                iconColor={proGroupsAvailable ? 'var(--primary-color)' : 'var(--disabled-color)'}
                iconSize="huge"
                unicode={LUCIDE_ICONS_UNICODE.USERS_ROUND}
              />
              <StatsLabel disabled={!proGroupsAvailable}>
                {tr('proGroupsUpgraded', {
                  count: proGroupsUpgraded,
                  total: formatProStats(proGroupsUpgraded),
                })}
              </StatsLabel>
              <SessionTooltip
                content={tr('proLargerGroupsTooltip')}
                horizontalPosition="left"
                maxContentWidth={'300px'}
                style={{ textAlign: 'center' }}
              >
                <LucideIcon
                  iconSize="small"
                  unicode={LUCIDE_ICONS_UNICODE.CIRCLE_HELP}
                  iconColor={proGroupsAvailable ? undefined : 'var(--disabled-color)'}
                />
              </SessionTooltip>
            </StatsItemContainer>
          </StatsRowContainer>
        </StatsContainer>
      </PanelButtonGroup>
    </SectionFlexContainer>
  );
}

function ProSettings({ state }: SectionProps) {
  const dispatch = getAppDispatch();
  const userHasPro = useCurrentUserHasProInternal();
  const userHasExpiredPro = useCurrentUserHasExpiredProInternal();
  const userNeverHadPro = useCurrentNeverHadProInternal();
  const { data, isLoading, isError } = useProBackendProStatusInternal();
  const backendErrorButtons = useBackendErrorDialogButtons();

  useKeepProStatusFresh({
    expiryTimeMs: data.expiryTimeMs,
    coverageEndMs: data.coverageEndMs,
    autoRenew: data.autoRenew,
    userHasExpiredPro,
    isLoading,
    isError,
  });

  const forceRefresh = useUpdate();

  const { proProfileBitset } = getCachedUserConfig();

  const proBadgeEnabled = ProFeaturesFinder.hasProFeature(
    proProfileBitset,
    ProMessageFeature.PRO_BADGE,
    'proProfile'
  );

  const { returnToThisModalAction, centerAlign } = state;

  const handleUpdateAccessClick = () => {
    dispatch(
      isError
        ? updateLocalizedPopupDialog({
            title: { token: 'proAccessError' },
            description: { token: 'proAccessNetworkLoadError' },
            overrideButtons: backendErrorButtons,
          })
        : isLoading
          ? updateLocalizedPopupDialog({
              title: { token: 'proAccessLoading' },
              description: { token: 'proAccessLoadingDescription' },
            })
          : data.isProcessingRefund
            ? userSettingsModal({
                userSettingsPage: 'proNonOriginating',
                nonOriginatingVariant: 'refundRequested',
                overrideBackAction: state.returnToThisModalAction,
              })
            : userSettingsModal({
                userSettingsPage: 'proNonOriginating',
                nonOriginatingVariant: 'update',
                overrideBackAction: returnToThisModalAction,
                centerAlign,
              })
    );
  };

  if (state.fromCTA ? !userHasPro : userNeverHadPro) {
    return <ProNonProContinueButton state={state} />;
  }

  if (userHasExpiredPro) {
    return null;
  }

  let subText: TrArgs;
  if (isError) {
    subText = { token: 'errorLoadingProAccess' };
  } else if (isLoading) {
    subText = { token: 'proAccessLoadingEllipsis' };
  } else if (data.inGracePeriod) {
    // Deliberately ahead of the two branches below: this one needs no date, so it must not be
    // suppressed by the no-date case. It is the message that is most correct when a fetch is struggling.
    subText = { token: 'proRenewalUnsuccessful' };
  } else if (!data.expiryTimeMs) {
    // No date yet — only a status response carries one. Say we are still finding out rather than
    // render "expiring in " with a hole where the time should be.
    subText = { token: 'proAccessLoadingEllipsis' };
  } else if (data.autoRenew) {
    subText = { token: 'proAutoRenewTime', time: data.expiryTimeRelativeString };
  } else {
    subText = { token: 'proExpiringTime', time: data.expiryTimeRelativeString };
  }

  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription title={{ token: 'proSettings' }} />
      <PanelButtonGroup>
        {data.isProcessingRefund ? (
          <PanelIconButton
            text={{ token: 'proRequestedRefund' }}
            subText={{
              token: 'processingRefundRequest',
              platform: data.providerConstants.platform,
            }}
            dataTestId="update-access-settings-button"
            onClick={handleUpdateAccessClick}
            iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.CIRCLE_ALERT} />}
            rowReverse
          />
        ) : (
          <SettingsChevronBasic
            baseDataTestId="update-access"
            text={{ token: 'updateAccess' }}
            subText={subText}
            onClick={handleUpdateAccessClick}
            loading={isLoading}
            subTextColor={isError || data.inGracePeriod ? 'var(--warning-color)' : undefined}
          />
        )}
        <SettingsToggleBasic
          baseDataTestId="pro-badge-visible"
          text={{ token: 'proBadge' }}
          subText={{ token: 'proBadgeVisible' }}
          onClick={async () => {
            await UserConfigWrapperActions.setProBadge(!proBadgeEnabled);
            forceRefresh();
          }}
          active={proBadgeEnabled}
        />
      </PanelButtonGroup>
    </SectionFlexContainer>
  );
}

function ProFeatureItem({
  textElement,
  iconElement,
  dataTestId,
  onClick,
}: {
  iconElement: ReactNode;
  textElement: ReactNode;
  dataTestId: SessionDataTestId;
  onClick?: () => Promise<void>;
}) {
  const isDarkTheme = useIsDarkThemeInternal();
  return (
    <>
      <StyledPanelButton
        disabled={!onClick}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={onClick}
        data-testid={dataTestId}
        $isDarkTheme={isDarkTheme}
        $defaultCursorWhenDisabled
      >
        <StyledContent style={{ gap: 'var(--margins-md)' }}>
          {iconElement}
          {textElement}
        </StyledContent>
      </StyledPanelButton>
    </>
  );
}

const ProFeatureTextContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--margins-xs);
  align-items: flex-start;
  text-align: start;
`;

const ProFeatureTitle = styled.div`
  display: inline-flex;
  color: var(--text-primary-color);
  font-size: var(--font-size-md);
  font-weight: 700;
`;

const ProFeatureDescription = styled.div`
  font-size: 12px; // just because 13px does not look good
  color: var(--text-secondary-color);
`;

const StyledFeatureIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  padding: 0;
  border-radius: var(--margins-xs);
  color: var(--black-color);
`;

type WithProFeaturePosition = { position: number };

function ProFeatureIconElement({
  unicode,
  position,
  noColor,
}: WithLucideUnicode & WithProFeaturePosition & { noColor?: boolean }) {
  const isDarkTheme = useIsDarkThemeInternal();
  const bgStyle =
    position === 0
      ? 'linear-gradient(135deg, #57C9FA 0%, #C993FF 100%)'
      : position === 1
        ? 'linear-gradient(135deg, #C993FF 0%, #FF95EF 100%)'
        : position === 2
          ? 'linear-gradient(135deg, #FF95EF 0%, #FF9C8E 100%)'
          : position === 3
            ? 'linear-gradient(135deg, #FF9C8E 0%, #FCB159 100%)'
            : position === 4
              ? 'linear-gradient(135deg, #FCB159 0%, #FAD657 100%)'
              : 'none';

  return (
    <Flex
      $container={true}
      $alignItems={'center'}
      $justifyContent={'center'}
      $flexGap="var(--margins-sm)"
    >
      <StyledFeatureIcon
        style={{
          background: noColor ? 'var(--disabled-color)' : bgStyle,
          boxShadow: isDarkTheme ? undefined : proBoxShadowSmall,
        }}
      >
        <LucideIcon unicode={unicode} iconSize="large" />
      </StyledFeatureIcon>
    </Flex>
  );
}

function getProFeatures(userHasPro: boolean): Array<
  {
    dataTestId: SessionDataTestId;
    id:
      | 'proLongerMessages'
      | 'proUnlimitedPins'
      | 'proAnimatedDisplayPictures'
      | 'proBadges'
      | 'plusLoadsMore';
    title: TrArgs;
    description: TrArgs;
  } & WithLucideUnicode
> {
  return [
    {
      dataTestId: 'longer-messages-pro-settings-menu-item',
      id: 'proLongerMessages',
      title: { token: 'proLongerMessages' as const },
      description: {
        token: userHasPro
          ? ('proLongerMessagesDescription' as const)
          : ('nonProLongerMessagesDescription' as const),
      },
      unicode: LUCIDE_ICONS_UNICODE.MESSAGE_SQUARE,
    },
    {
      dataTestId: 'more-pins-pro-settings-menu-item',
      id: 'proUnlimitedPins',
      title: { token: 'proUnlimitedPins' as const },
      description: {
        token: userHasPro
          ? ('proUnlimitedPinsDescription' as const)
          : ('nonProUnlimitedPinnedDescription' as const),
      },
      unicode: LUCIDE_ICONS_UNICODE.PIN,
    },
    {
      dataTestId: 'animated-display-picture-pro-settings-menu-item',
      id: 'proAnimatedDisplayPictures',
      title: { token: 'proAnimatedDisplayPictures' as const },
      description: { token: 'proAnimatedDisplayPicturesDescription' as const },
      unicode: LUCIDE_ICONS_UNICODE.SQUARE_PLAY,
    },
    {
      dataTestId: 'badges-pro-settings-menu-item',
      id: 'proBadges',
      title: { token: 'proBadges' as const },
      description: { token: 'proBadgesDescription' as const },
      unicode: LUCIDE_ICONS_UNICODE.RECTANGLE_ELLIPSES,
    },
    {
      dataTestId: 'loads-more-pro-settings-menu-item',
      id: 'plusLoadsMore',
      title: { token: 'plusLoadsMore' as const },
      description: {
        token: 'plusLoadsMoreDescription' as const,
        icon: LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON,
      },
      unicode: LUCIDE_ICONS_UNICODE.CIRCLE_PLUS,
    },
  ];
}

function ProFeatures({ state }: SectionProps) {
  const dispatch = getAppDispatch();
  const userHasPro = useCurrentUserHasProInternal();
  const expiredPro = useCurrentUserHasExpiredProInternal();
  const proFeatures = getProFeatures(userHasPro);

  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription
        title={{ token: 'proBetaFeatures' }}
        dataTestId="pro-settings-features-header"
      />
      <PanelButtonGroup containerStyle={{ marginBlock: 'var(--margins-xs)' }}>
        {proFeatures.map((m, i) => {
          return (
            <ProFeatureItem
              dataTestId={m.dataTestId}
              onClick={
                m.id === 'plusLoadsMore'
                  ? async () => {
                      showLinkVisitWarningDialog(
                        LIBSESSION_CONSTANTS.LIBSESSION_PRO_URLS.roadmap,
                        dispatch
                      );
                    }
                  : undefined
              }
              iconElement={
                <ProFeatureIconElement
                  position={i}
                  unicode={m.unicode}
                  noColor={expiredPro && !state.fromCTA}
                />
              }
              textElement={
                <ProFeatureTextContainer>
                  <ProFeatureTitle>
                    {m.id === 'proBadges' && (
                      <ProIconButton
                        dataTestId="invalid-data-testid"
                        onClick={undefined}
                        iconSize="small"
                        style={{ marginInlineEnd: 'var(--margins-xs)' }}
                        noColors={expiredPro && !state.fromCTA}
                      />
                    )}
                    <Localizer {...m.title} />
                  </ProFeatureTitle>
                  <ProFeatureDescription>
                    <Localizer {...m.description} />
                  </ProFeatureDescription>
                </ProFeatureTextContainer>
              }
            />
          );
        })}
      </PanelButtonGroup>
    </SectionFlexContainer>
  );
}

function ManageProCurrentAccess({ state }: SectionProps) {
  const dispatch = getAppDispatch();
  const { data } = useProBackendProStatusInternal();
  const userHasPro = useCurrentUserHasProInternal();
  if (!userHasPro) {
    return null;
  }

  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription
        title={{ token: 'managePro' }}
        dataTestId="pro-settings-manage-header"
      />
      <PanelButtonGroup>
        {data.autoRenew ? (
          <PanelIconButton
            text={{ token: 'cancelAccess' }}
            dataTestId="cancel-pro-button"
            onClick={() => {
              dispatch(
                userSettingsModal({
                  userSettingsPage: 'proNonOriginating',
                  nonOriginatingVariant: 'cancel',
                  overrideBackAction: state.returnToThisModalAction,
                  centerAlign: state.centerAlign,
                })
              );
            }}
            color={'var(--danger-color)'}
            iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.CIRCLE_X} />}
            rowReverse
          />
        ) : null}
        <PanelIconButton
          text={{ token: 'requestRefund' }}
          dataTestId="request-refund-button"
          onClick={() => {
            dispatch(
              userSettingsModal({
                userSettingsPage: 'proNonOriginating',
                nonOriginatingVariant: 'refund',
                overrideBackAction: state.returnToThisModalAction,
              })
            );
          }}
          color={'var(--danger-color)'}
          iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.CIRCLE_ALERT} />}
          rowReverse
        />
      </PanelButtonGroup>
    </SectionFlexContainer>
  );
}

function ManageProAccess({ state }: SectionProps) {
  const dispatch = getAppDispatch();
  const isDarkTheme = useIsDarkThemeInternal();
  const userHasExpiredPro = useCurrentUserHasExpiredProInternal();

  const { returnToThisModalAction, centerAlign } = state;

  const { isLoading, isError } = useProBackendProStatusInternal();

  const backendErrorButtons = useBackendErrorDialogButtons();

  const handleClickRenew = () => {
    dispatch(
      isError
        ? updateLocalizedPopupDialog({
            title: { token: 'proStatusError' },
            description: { token: 'proStatusRenewError' },
            overrideButtons: backendErrorButtons,
          })
        : isLoading
          ? updateLocalizedPopupDialog({
              title: { token: 'proStatusLoading' },
              description: { token: 'checkingProStatusRenew' },
            })
          : userSettingsModal({
              userSettingsPage: 'proNonOriginating',
              nonOriginatingVariant: 'renew',
              overrideBackAction: returnToThisModalAction,
              centerAlign,
            })
    );
  };

  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription
        title={{ token: 'managePro' }}
        dataTestId="pro-settings-manage-header"
      />
      <PanelButtonGroup
        style={
          !isDarkTheme
            ? {
                boxShadow: proBoxShadow,
              }
            : undefined
        }
      >
        {userHasExpiredPro ? (
          <PanelIconButton
            text={{ token: 'proAccessRenew' }}
            dataTestId="renew-pro-button"
            onClick={handleClickRenew}
            color={isDarkTheme && !isError && !isLoading ? 'var(--primary-color)' : undefined}
            iconElement={
              isLoading ? (
                <AnimatedSpinnerIcon size="huge" />
              ) : (
                <PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.CIRCLE_PLUS} />
              )
            }
            rowReverse
            {...(isError || isLoading
              ? {
                  subText: isError
                    ? { token: 'errorCheckingProStatus' }
                    : { token: 'checkingProStatusEllipsis' },
                  subTextColorOverride: isError ? 'var(--warning-color)' : undefined,
                }
              : {})}
          />
        ) : null}
      </PanelButtonGroup>
    </SectionFlexContainer>
  );
}

function ManageProPreviousAccess(props: SectionProps) {
  const userHasExpiredPro = useCurrentUserHasExpiredProInternal();

  return userHasExpiredPro ? <ManageProAccess {...props} /> : null;
}

function ProHelp() {
  const dispatch = getAppDispatch();
  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription title={{ token: 'sessionHelp' }} />
      <PanelButtonGroup>
        <SettingsExternalLinkBasic
          baseDataTestId="pro-faq"
          text={{ token: 'proFaq' }}
          subText={{ token: 'proFaqDescription' }}
          onClick={async () =>
            showLinkVisitWarningDialog('https://getsession.org/faq#pro', dispatch)
          }
        />
        <SettingsExternalLinkBasic
          baseDataTestId="pro-support"
          text={{ token: 'helpSupport' }}
          subText={{ token: 'proSupportDescription' }}
          onClick={async () =>
            showLinkVisitWarningDialog(
              LIBSESSION_CONSTANTS.LIBSESSION_PRO_URLS.support_url,
              dispatch
            )
          }
        />
      </PanelButtonGroup>
    </SectionFlexContainer>
  );
}

function HeroStatusText({
  isError,
  isLoading,
  isPro,
}: {
  isError?: boolean;
  isLoading?: boolean;
  isPro?: boolean;
}) {
  if (isError) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
        <Localizer token={isPro ? 'proErrorRefreshingStatus' : 'errorCheckingProStatus'} />
        <LucideIcon
          unicode={LUCIDE_ICONS_UNICODE.TRIANGLE_ALERT}
          iconColor="var(--warning-color)"
          iconSize="small"
          style={{ paddingBottom: '2px', paddingInline: '2px' }}
        />
      </div>
    );
  }
  if (isLoading) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--margins-xs)' }}>
        <Localizer token={isPro ? 'proStatusLoadingSubtitle' : 'checkingProStatus'} />
        <AnimatedSpinnerIcon size="small" />
      </div>
    );
  }
  return null;
}

function PageHero({ state }: SectionProps) {
  const dispatch = getAppDispatch();
  const isPro = useCurrentUserHasProInternal();
  const proExpired = useCurrentUserHasExpiredProInternal();
  const { isLoading, isError } = useProBackendProStatusInternal();

  const backendErrorButtons = useBackendErrorDialogButtons();

  const handleClick = () => {
    if (isError) {
      dispatch(
        updateLocalizedPopupDialog({
          title: { token: 'proStatusError' },
          description: {
            token:
              isPro || (proExpired && !state.fromCTA)
                ? 'proStatusRefreshNetworkError'
                : 'proStatusNetworkErrorContinue',
          },
          overrideButtons: backendErrorButtons,
        })
      );
      return;
    }

    if (isLoading) {
      dispatch(
        updateLocalizedPopupDialog(
          isPro
            ? {
                title: { token: 'proStatusLoading' },
                description: { token: 'proStatusLoadingDescription' },
              }
            : {
                title: { token: 'checkingProStatus' },
                description: {
                  token:
                    proExpired && !state.fromCTA
                      ? 'checkingProStatusDescription'
                      : 'checkingProStatusContinue',
                },
              }
        )
      );
    }
  };

  const heroTextToken = isPro
    ? 'proThanksForSupporting'
    : proExpired
      ? 'proAccessRenewStart'
      : 'proFullestPotential';

  return (
    <ProHeroImage
      onClick={handleClick}
      heroStatusText={<HeroStatusText isError={isError} isLoading={isLoading} isPro={isPro} />}
      heroText={<Localizer token={heroTextToken} />}
      isError={isError}
      noColors={proExpired && !state.fromCTA}
    />
  );
}

export function ProSettingsPage(modalState: {
  userSettingsPage: 'pro';
  hideBackButton?: boolean;
  fromCTA?: boolean;
  centerAlign?: boolean;
  afterCloseAction?: () => void;
}) {
  const dispatch = getAppDispatch();
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);

  const returnToThisModalAction = useCallback(() => {
    dispatch(userSettingsModal(modalState));
  }, [dispatch, modalState]);

  const proSettingsModalState = {
    fromCTA: modalState.fromCTA,
    returnToThisModalAction,
    afterCloseAction: modalState.afterCloseAction,
    centerAlign: modalState.centerAlign,
  } satisfies ProSettingsModalState;

  return (
    <UserSettingsModalContainer
      headerChildren={
        <ModalBasicHeader
          title={null}
          bigHeader={true}
          showExitIcon={true}
          floatingHeader={true}
          extraLeftButton={
            backAction && !modalState.hideBackButton ? (
              <ModalBackButton onClick={backAction} />
            ) : undefined
          }
        />
      }
      onClose={closeAction || undefined}
      centerAlign={modalState.centerAlign}
    >
      <ModalFlexContainer>
        <PageHero state={proSettingsModalState} />
        <ProStats />
        {!modalState.fromCTA ? <ManageProPreviousAccess state={proSettingsModalState} /> : null}
        <ProSettings state={proSettingsModalState} />
        <ProFeatures state={proSettingsModalState} />
        {!modalState.fromCTA ? <ManageProCurrentAccess state={proSettingsModalState} /> : null}
        {!modalState.fromCTA ? <ProHelp /> : null}
      </ModalFlexContainer>
    </UserSettingsModalContainer>
  );
}
