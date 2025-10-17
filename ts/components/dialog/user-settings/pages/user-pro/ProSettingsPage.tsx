import { isNumber } from 'lodash';
import { useMemo, type ReactNode } from 'react';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import { ModalBasicHeader } from '../../../../SessionWrapperModal';
import { useUserSettingsBackAction, useUserSettingsCloseAction } from '../userSettingsHooks';
import {
  userSettingsModal,
  type UserSettingsModalState,
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
} from '../../../../../hooks/useHasPro';
import { SessionButton, SessionButtonColor } from '../../../../basic/SessionButton';
import { proButtonProps } from '../../../SessionProInfoModal';

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
          ${props =>
              props.noColors
                ? 'var(--chat-buttons-background-hover-color)'
                : 'var(--primary-color)'}
            20%,
          transparent
        )
        0%,
      transparent 70%
    );
    filter: blur(45px);

    z-index: -1; /* behind the logo */
  }
`;

const HeroImageLabelContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--margins-sm);
  padding: var(--margins-md);
`;

export const StyledProStatusText = styled.p`
  text-align: center;
  line-height: var(--font-size-md);
  font-size: var(--font-size-md);
`;

export function ProHeroImage({ noColors, heroText }: { noColors?: boolean; heroText?: ReactNode }) {
  return (
    <>
      <SectionFlexContainer style={{ position: 'relative' }}>
        <HeroImageBgContainer>
          <HeroImageBg noColors={noColors}>
            <SessionIcon
              iconType="brand"
              iconColor={
                noColors ? 'var(--chat-buttons-background-hover-color)' : 'var(--primary-color)'
              }
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
      {heroText ? <StyledProStatusText>{heroText}</StyledProStatusText> : null}
    </>
  );
}

function ProNonProContinueButton() {
  const dispatch = useDispatch();
  const neverHadPro = useCurrentNeverHadPro();
  if (!neverHadPro) {
    return null;
  }

  return (
    <SessionButton
      {...proButtonProps}
      buttonColor={SessionButtonColor.PrimaryDark}
      onClick={() => {
        dispatch(
          userSettingsModal({
            userSettingsPage: 'proNonOriginating',
            nonOriginatingVariant: 'upgrade',
          })
        );
      }}
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

const StatsLabel = styled.div`
  font-size: var(--font-size-md);
  color: var(--text-primary-color);
  font-weight: 700;
`;

function ProStats() {
  const proLongerMessagesSent = Storage.get(SettingsKey.proLongerMessagesSent) || 3000;
  const proPinnedConversations = Storage.get(SettingsKey.proPinnedConversations) || 0;
  const proBadgesSent = Storage.get(SettingsKey.proBadgesSent) || 0;
  const proGroupsUpgraded = Storage.get(SettingsKey.proGroupsUpgraded) || 0;

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(getBrowserLocale(), {
        notation: 'compact',
        compactDisplay: 'short', // Uses 'K', 'M', 'B' etc.
      }),
    []
  );

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
      <PanelButtonGroup>
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
                iconColor="var(--disabled-color)"
                iconSize="huge"
                unicode={LUCIDE_ICONS_UNICODE.USERS_ROUND}
              />
              <StatsLabel>
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
                <LucideIcon iconSize="small" unicode={LUCIDE_ICONS_UNICODE.CIRCLE_HELP} />
              </SessionTooltip>
            </StatsItemContainer>
          </StatsRowContainer>
        </StatsContainer>
      </PanelButtonGroup>
    </SectionFlexContainer>
  );
}

function ProSettings() {
  const dispatch = useDispatch();
  const userHasPro = useCurrentUserHasPro();
  if (!userHasPro) {
    return <ProNonProContinueButton />;
  }

  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription title={{ token: 'proSettings' }} />
      <PanelButtonGroup>
        <SettingsChevronBasic
          baseDataTestId="update-access"
          text={{ token: 'updateAccess' }}
          subText={{ token: 'proAutoRenewTime', time: '{time}' }}
          onClick={async () => {
            dispatch(
              userSettingsModal({
                userSettingsPage: 'proNonOriginating',
                nonOriginatingVariant: 'update',
              })
            );
          }}
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
  onClick,
}: {
  iconElement: ReactNode;
  textElement: ReactNode;
  onClick?: () => Promise<void>;
}) {
  const isDarkTheme = useIsDarkTheme();
  return (
    <>
      <StyledPanelButton
        disabled={!onClick}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={onClick}
        data-testid={'invalid-data-testid'}
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
        style={{ background: noColor ? 'var(--chat-buttons-background-hover-color)' : bgStyle }}
      >
        <LucideIcon unicode={unicode} iconSize={'huge'} />
      </StyledFeatureIcon>
    </Flex>
  );
}

function getProFeatures(_userHasPro: boolean): Array<
  {
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
      id: 'proLongerMessages',
      title: { token: 'proLongerMessages' as const },
      description: { token: 'proLongerMessagesDescription' as const },
      unicode: LUCIDE_ICONS_UNICODE.MESSAGE_SQUARE,
    },
    {
      id: 'proUnlimitedPins',
      title: { token: 'proUnlimitedPins' as const },
      description: { token: 'proUnlimitedPinsDescription' as const },
      unicode: LUCIDE_ICONS_UNICODE.PIN,
    },
    {
      id: 'proAnimatedDisplayPictures',
      title: { token: 'proAnimatedDisplayPictures' as const },
      description: { token: 'proAnimatedDisplayPicturesDescription' as const },
      unicode: LUCIDE_ICONS_UNICODE.SQUARE_PLAY,
    },
    {
      id: 'proBadges',
      title: { token: 'proBadges' as const },
      description: { token: 'proBadgesDescription' as const },
      unicode: LUCIDE_ICONS_UNICODE.RECTANGLE_ELLIPSES,
    },
    {
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

function ManageProCurrentAccess() {
  const dispatch = useDispatch();
  const userHasPro = useCurrentUserHasPro();
  if (!userHasPro) {
    return null;
  }

  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription title={{ token: 'managePro' }} />
      <PanelButtonGroup>
        <PanelIconButton
          text={{ token: 'cancelAccess' }}
          dataTestId="cancel-pro-button"
          onClick={() => {
            dispatch(
              userSettingsModal({
                userSettingsPage: 'proNonOriginating',
                nonOriginatingVariant: 'cancel',
              })
            );
          }}
          color={'var(--danger-color)'}
          iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.CIRCLE_X} />}
          rowReverse
        />
        <PanelIconButton
          text={{ token: 'requestRefund' }}
          dataTestId="request-refund-button"
          onClick={() => {
            dispatch(
              userSettingsModal({
                userSettingsPage: 'proNonOriginating',
                nonOriginatingVariant: 'refund',
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

function ManageProPreviousAccess() {
  const dispatch = useDispatch();
  const userHasExpiredPro = useCurrentUserHasExpiredPro();
  if (!userHasExpiredPro) {
    return null;
  }

  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription title={{ token: 'managePro' }} />
      <PanelButtonGroup>
        <PanelIconButton
          text={{ token: 'proAccessRenew' }}
          dataTestId="cancel-pro-button"
          onClick={() => {
            dispatch(
              userSettingsModal({
                userSettingsPage: 'proNonOriginating',
                nonOriginatingVariant: 'renew',
              })
            );
          }}
          color={'var(--primary-color)'}
          iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.CIRCLE_PLUS} />}
          rowReverse
        />
        <PanelIconButton
          text={{ token: 'proAccessRecover' }}
          dataTestId="recover-pro-button"
          onClick={() => {
            // TODO: implement
          }}
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

export function ProSettingsPage(modalState: UserSettingsModalState) {
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);
  const neverHadPro = useCurrentNeverHadPro();
  const proExpired = useCurrentUserHasExpiredPro();

  return (
    <UserSettingsModalContainer
      headerChildren={
        <ModalBasicHeader
          title={null}
          bigHeader={true}
          showExitIcon={true}
          extraLeftButton={backAction ? <ModalBackButton onClick={backAction} /> : undefined}
        />
      }
      onClose={closeAction || undefined}
    >
      <ModalFlexContainer>
        <ProHeroImage
          heroText={
            neverHadPro
              ? // TODO: this doesnt match figma, check on it
                tr('proUserProfileModalCallToAction')
              : null
          }
          noColors={proExpired}
        />
        <ProStats />
        <ManageProPreviousAccess />
        <ProSettings />
        <ProFeatures />
        <ManageProCurrentAccess />
        <ProHelp />
      </ModalFlexContainer>
    </UserSettingsModalContainer>
  );
}
