import { isNumber } from 'lodash';
import { MouseEventHandler, SessionDataTestId, useCallback, useMemo, type ReactNode } from 'react';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';
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
import { getBrowserLocale } from '../../../../../util/i18n/shared';
import { SessionIcon } from '../../../../icon';
import { ProIconButton } from '../../../../buttons/ProButton';
import { useIsDarkTheme } from '../../../../../state/theme/selectors/theme';
import { Flex } from '../../../../basic/Flex';
import { Localizer } from '../../../../basic/Localizer';
import {
  useCurrentUserHasPro,
  useCurrentUserHasExpiredPro,
  useCurrentNeverHadPro,
  useProAccessDetails,
} from '../../../../../hooks/useHasPro';
import { SessionButton, SessionButtonColor } from '../../../../basic/SessionButton';
import { proButtonProps } from '../../../SessionProInfoModal';
import { useIsProGroupsAvailable } from '../../../../../hooks/useIsProAvailable';
import { SpacerMD } from '../../../../basic/Text';
import { sleepFor } from '../../../../../session/utils/Promise';
import { AnimatedSpinnerIcon } from '../../../../loading/spinner/AnimatedSpinnerIcon';

// TODO: There are only 2 props here and both are passed to the nonorigin modal dispatch, can probably be in their own object
type SectionProps = {
  returnToThisModalAction: () => void;
  centerAlign?: boolean;
};

const SectionFlexContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;

const HeroImageBgContainer = styled.div`
  height: 220px;
`;

const HeroImageBg = styled.div<{ noColors?: boolean }>`
  position: absolute;
  left: 0;
  right: 0;
  top: 15%;

  justify-items: center;

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
          ${props => (props.noColors ? 'var(--disabled-color) 35%' : 'var(--primary-color) 25%')},
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

export const StyledProStatusText = styled.div<{ isError?: boolean }>`
  text-align: center;
  line-height: var(--font-size-sm);
  font-size: var(--font-size-sm);
  ${props => (props.isError ? 'color: var(--warning-color);' : '')}
`;

export const StyledProHeroText = styled.div`
  text-align: center;
  line-height: var(--font-size-md);
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
          <HeroImageBg noColors={noColors}>
            <SessionIcon
              iconType="brand"
              iconColor={noColors ? 'var(--disabled-color)' : 'var(--primary-color)'}
              iconSize={132}
            />
            <HeroImageLabelContainer>
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
        <StyledProStatusText isError={isError}>{heroStatusText}</StyledProStatusText>
      ) : null}
      {heroStatusText && heroText ? <SpacerMD /> : null}
      {heroText ? <StyledProHeroText>{heroText}</StyledProHeroText> : null}
    </SectionFlexContainer>
  );
}

function useBackendErrorDialogButtons() {
  const dispatch = useDispatch();
  const { refetch } = useProAccessDetails();

  const buttons = useMemo(() => {
    return [
      {
        label: { token: 'retry' },
        dataTestId: 'pro-backend-error-retry-button',
        onClick: refetch,
        closeAfterClick: true,
      },
      {
        label: { token: 'helpSupport' },
        dataTestId: 'pro-backend-error-support-button',
        onClick: () => {
          showLinkVisitWarningDialog('https://getsession.org/pro-form', dispatch);
        },
        closeAfterClick: true,
      },
    ] satisfies Array<LocalizedPopupDialogButtonOptions>;
  }, [dispatch, refetch]);

  return buttons;
}

function ProNonProContinueButton({ returnToThisModalAction, centerAlign }: SectionProps) {
  const dispatch = useDispatch();
  const neverHadPro = useCurrentNeverHadPro();
  const { isLoading, isError } = useProAccessDetails();

  const backendErrorButtons = useBackendErrorDialogButtons();

  const handleClick = useCallback(() => {
    dispatch(
      isError
        ? updateLocalizedPopupDialog({
            title: { token: 'proStatusError' },
            description: { token: 'proStatusNetworkErrorDescription' },
            overrideButtons: backendErrorButtons,
          })
        : isLoading
          ? updateLocalizedPopupDialog({
              title: { token: 'proStatusLoading' },
              description: { token: 'proStatusLoadingDescription' },
            })
          : userSettingsModal({
              userSettingsPage: 'proNonOriginating',
              nonOriginatingVariant: 'upgrade',
              overrideBackAction: returnToThisModalAction,
              centerAlign,
            })
    );
  }, [dispatch, isLoading, isError, backendErrorButtons, centerAlign, returnToThisModalAction]);

  if (!neverHadPro) {
    return null;
  }

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

function ProStats() {
  const proLongerMessagesSent = Storage.get(SettingsKey.proLongerMessagesSent) || 0;
  const proPinnedConversations = Storage.get(SettingsKey.proPinnedConversations) || 0;
  const proBadgesSent = Storage.get(SettingsKey.proBadgesSent) || 0;
  const proGroupsUpgraded = Storage.get(SettingsKey.proGroupsUpgraded) || 0;

  const isDarkTheme = useIsDarkTheme();

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(getBrowserLocale(), {
        notation: 'compact',
        compactDisplay: 'short', // Uses 'K', 'M', 'B' etc.
      }),
    []
  );

  const proGroupsAvailable = useIsProGroupsAvailable();

  const userHasPro = useCurrentUserHasPro();
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
        extraInlineNode={
          <SessionTooltip content={tr('proStatsTooltip')} maxContentWidth={'300px'}>
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
                  total: formatter.format(proLongerMessagesSent).toLocaleLowerCase(),
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
                  total: formatter.format(proPinnedConversations).toLocaleLowerCase(),
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
                  total: formatter.format(proBadgesSent).toLocaleLowerCase(),
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
                  total: formatter.format(proGroupsUpgraded).toLocaleLowerCase(),
                })}
              </StatsLabel>
              <SessionTooltip
                content={tr('proLargerGroupsTooltip')}
                horizontalPosition="left"
                maxContentWidth={'300px'}
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

function ProSettings({ returnToThisModalAction, centerAlign }: SectionProps) {
  const dispatch = useDispatch();
  const userHasPro = useCurrentUserHasPro();
  const { data, isLoading, isError } = useProAccessDetails();
  const backendErrorButtons = useBackendErrorDialogButtons();

  const handleUpdateAccessClick = useCallback(() => {
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
          : userSettingsModal({
              userSettingsPage: 'proNonOriginating',
              nonOriginatingVariant: 'update',
              overrideBackAction: returnToThisModalAction,
              centerAlign,
            })
    );
  }, [dispatch, isLoading, isError, backendErrorButtons, centerAlign, returnToThisModalAction]);

  if (!userHasPro) {
    return (
      <ProNonProContinueButton
        returnToThisModalAction={returnToThisModalAction}
        centerAlign={centerAlign}
      />
    );
  }

  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription title={{ token: 'proSettings' }} />
      <PanelButtonGroup>
        <SettingsChevronBasic
          baseDataTestId="update-access"
          text={{ token: 'updateAccess' }}
          subText={{
            token: isError
              ? 'errorLoadingProAccess'
              : isLoading
                ? 'proAccessLoadingEllipsis'
                : data.inGracePeriod
                  ? 'proRenewalUnsuccessful'
                  : data.autoRenew
                    ? 'proAutoRenewTime'
                    : 'proExpiringTime',
            time: data.expiryTimeRelativeString,
          }}
          onClick={handleUpdateAccessClick}
          loading={isLoading}
          subTextColor={isError || data.inGracePeriod ? 'var(--warning-color)' : undefined}
        />
        <SettingsToggleBasic
          baseDataTestId="pro-badge-visible"
          text={{ token: 'proBadge' }}
          subText={{ token: 'proBadgeVisible' }}
          onClick={async () => {
            throw new Error('Not implemented, and state {false} too');
          }}
          active={false}
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
  const isDarkTheme = useIsDarkTheme();
  return (
    <>
      <StyledPanelButton
        disabled={!onClick}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={onClick}
        data-testid={dataTestId}
        isDarkTheme={isDarkTheme}
        defaultCursorWhenDisabled
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
  const isDarkTheme = useIsDarkTheme();
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

function ProFeatures() {
  const dispatch = useDispatch();
  const userHasPro = useCurrentUserHasPro();
  const expiredPro = useCurrentUserHasExpiredPro();
  const proFeatures = useMemo(() => getProFeatures(userHasPro), [userHasPro]);

  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription title={{ token: 'proBetaFeatures' }} />
      <PanelButtonGroup containerStyle={{ marginBlock: 'var(--margins-xs)' }}>
        {proFeatures.map((m, i) => {
          return (
            <ProFeatureItem
              dataTestId={m.dataTestId}
              onClick={
                m.id === 'plusLoadsMore'
                  ? async () => {
                      showLinkVisitWarningDialog('https://getsession.org/pro-roadmap', dispatch);
                    }
                  : undefined
              }
              iconElement={
                <ProFeatureIconElement position={i} unicode={m.unicode} noColor={expiredPro} />
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
                        noColors={expiredPro}
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

function ManageProCurrentAccess({ returnToThisModalAction, centerAlign }: SectionProps) {
  const dispatch = useDispatch();
  const { data } = useProAccessDetails();
  const userHasPro = useCurrentUserHasPro();
  if (!userHasPro) {
    return null;
  }

  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription title={{ token: 'managePro' }} />
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
                  overrideBackAction: returnToThisModalAction,
                  centerAlign,
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
                overrideBackAction: returnToThisModalAction,
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

// TODO: add logic to call libsession state
function useRecoverProStatus() {
  const fetchAccess = useCallback(async () => {
    await sleepFor(5000);
    return { ok: false };
  }, []);

  return { fetchAccess };
}

function ManageProPreviousAccess({ returnToThisModalAction, centerAlign }: SectionProps) {
  const dispatch = useDispatch();
  const isDarkTheme = useIsDarkTheme();
  const userHasExpiredPro = useCurrentUserHasExpiredPro();

  const { isLoading, isError } = useProAccessDetails();
  const { fetchAccess: fetchRecoverAccess } = useRecoverProStatus();

  const backendErrorButtons = useBackendErrorDialogButtons();

  const handleClickRenew = useCallback(() => {
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
  }, [dispatch, isLoading, isError, backendErrorButtons, centerAlign, returnToThisModalAction]);

  const handleClickRecover = useCallback(async () => {
    const result = await fetchRecoverAccess();

    if (result.ok) {
      return dispatch(
        updateLocalizedPopupDialog({
          title: { token: 'proAccessRestored' },
          description: { token: 'proAccessRestoredDescription' },
        })
      );
    }
    return dispatch(
      updateLocalizedPopupDialog({
        title: { token: 'proAccessNotFound' },
        description: { token: 'proAccessNotFoundDescription' },
        overrideButtons: [
          {
            label: { token: 'helpSupport' },
            dataTestId: 'pro-backend-error-support-button',
            onClick: () => {
              showLinkVisitWarningDialog(
                'https://sessionapp.zendesk.com/hc/sections/4416517450649-Support',
                dispatch
              );
            },
            closeAfterClick: true,
          },
          {
            label: { token: 'close' },
            dataTestId: 'modal-close-button',
            closeAfterClick: true,
          },
        ],
      })
    );
  }, [dispatch, fetchRecoverAccess]);

  if (!userHasExpiredPro) {
    return null;
  }

  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription title={{ token: 'managePro' }} />
      <PanelButtonGroup
        style={
          !isDarkTheme
            ? {
                boxShadow: proBoxShadow,
              }
            : undefined
        }
      >
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
        <PanelIconButton
          text={{ token: 'proAccessRecover' }}
          dataTestId="recover-pro-button"
          onClick={() => void handleClickRecover()}
          iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.REFRESH_CW} />}
          rowReverse
        />
      </PanelButtonGroup>
    </SectionFlexContainer>
  );
}

function ProHelp() {
  const dispatch = useDispatch();
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
            showLinkVisitWarningDialog('https://getsession.org/pro-form', dispatch)
          }
        />
      </PanelButtonGroup>
    </SectionFlexContainer>
  );
}

function PageHero() {
  const dispatch = useDispatch();
  const neverHadPro = useCurrentNeverHadPro();
  const proExpired = useCurrentUserHasExpiredPro();
  const { isLoading, isError } = useProAccessDetails();

  const backendErrorButtons = useBackendErrorDialogButtons();

  const handleClick = useCallback(() => {
    if (isError) {
      dispatch(
        updateLocalizedPopupDialog({
          title: { token: 'proStatusError' },
          description: { token: 'proStatusRefreshNetworkError' },
          overrideButtons: backendErrorButtons,
        })
      );
      return;
    }

    if (isLoading) {
      dispatch(
        updateLocalizedPopupDialog({
          title: { token: 'proStatusLoading' },
          description: { token: 'proStatusLoadingDescription' },
        })
      );
    }
    // Do nothing if not error or loading
  }, [dispatch, isLoading, isError, backendErrorButtons]);

  const heroStatusText = useMemo(() => {
    if (isError) {
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Localizer token={neverHadPro ? 'errorCheckingProStatus' : 'proErrorRefreshingStatus'} />
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
          <Localizer token={neverHadPro ? 'checkingProStatus' : 'proStatusLoading'} />
          <AnimatedSpinnerIcon size="small" />
        </div>
      );
    }
    return null;
  }, [isLoading, isError, neverHadPro]);

  return (
    <ProHeroImage
      onClick={handleClick}
      heroStatusText={heroStatusText}
      heroText={neverHadPro ? <Localizer token="proFullestPotential" /> : null}
      isError={isError}
      noColors={proExpired}
    />
  );
}

export function ProSettingsPage(modalState: {
  userSettingsPage: 'pro';
  hideBackButton?: boolean;
  hideHelp?: boolean;
  centerAlign?: boolean;
}) {
  const dispatch = useDispatch();
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);

  const returnToThisModalAction = useCallback(() => {
    dispatch(userSettingsModal(modalState));
  }, [dispatch, modalState]);

  return (
    <UserSettingsModalContainer
      headerChildren={
        <ModalBasicHeader
          title={null}
          bigHeader={true}
          showExitIcon={true}
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
        <PageHero />
        <ProStats />
        <ManageProPreviousAccess
          returnToThisModalAction={returnToThisModalAction}
          centerAlign={modalState.centerAlign}
        />
        <ProSettings
          returnToThisModalAction={returnToThisModalAction}
          centerAlign={modalState.centerAlign}
        />
        <ProFeatures />
        <ManageProCurrentAccess
          returnToThisModalAction={returnToThisModalAction}
          centerAlign={modalState.centerAlign}
        />
        {!modalState.hideHelp ? <ProHelp /> : null}
      </ModalFlexContainer>
    </UserSettingsModalContainer>
  );
}
