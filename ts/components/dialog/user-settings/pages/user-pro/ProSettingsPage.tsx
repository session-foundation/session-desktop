import { isNumber } from 'lodash';
import { useMemo } from 'react';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import { ModalBasicHeader } from '../../../../SessionWrapperModal';
import { useUserSettingsBackAction, useUserSettingsCloseAction } from '../userSettingsHooks';
import type { UserSettingsModalState } from '../../../../../state/ducks/modalDialog';
import { ModalBackButton } from '../../../shared/ModalBackButton';
import { UserSettingsModalContainer } from '../../components/UserSettingsModalContainer';
import { ModalFlexContainer } from '../../../shared/ModalFlexContainer';
import { PanelButtonGroup, PanelLabelWithDescription } from '../../../../buttons/panel/PanelButton';
import { SettingsExternalLinkBasic } from '../../components/SettingsExternalLinkBasic';
import { showLinkVisitWarningDialog } from '../../../OpenUrlModal';
import { PanelIconButton, PanelIconLucideIcon } from '../../../../buttons/panel/PanelIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../../../icon/lucide';
import { SettingsChevronBasic } from '../../components/SettingsChevronBasic';
import { SettingsToggleBasic } from '../../components/SettingsToggleBasic';
import { SessionTooltip } from '../../../../SessionTooltip';
import { tr } from '../../../../../localization/localeTools';
import { LucideIcon } from '../../../../icon/LucideIcon';
import { Storage } from '../../../../../util/storage';
import { SettingsKey } from '../../../../../data/settings-key';
import { getBrowserLocale } from '../../../../../util/i18n/shared';
import { SessionIcon } from '../../../../icon';
import { ProIconButton } from '../../../../buttons/ProButton';

const SectionFlexContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
`;

const HeroImageBgContainer = styled.div`
  height: 170px;
`;

const HeroImageBg = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  justify-items: center;

  &::before {
    content: '';
    position: absolute;
    top: -40%;
    left: -40%;
    width: 180%;
    height: 180%;
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--primary-color) 15%, transparent) 0%,
      transparent 70%
    );

    filter: blur(60px);
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

function ProHeroImage() {
  return (
    <SectionFlexContainer>
      <HeroImageBgContainer>
        <HeroImageBg>
          <SessionIcon iconType="brand" iconColor="var(--primary-color)" iconSize={110} />
          <HeroImageLabelContainer>
            <img src="images/session/session-text.svg" alt="full-brand-text" height={17} />
            <ProIconButton iconSize="large" dataTestId="invalid-data-testid" />
          </HeroImageLabelContainer>
        </HeroImageBg>
      </HeroImageBgContainer>
    </SectionFlexContainer>
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
              <SessionTooltip content="">
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
  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription title={{ token: 'proSettings' }} />
      <PanelButtonGroup>
        <SettingsChevronBasic
          baseDataTestId="update-plan"
          text={{ token: 'updatePlan' }}
          subText={{ token: 'proAutoRenewTime', time: '{time}' }}
          onClick={async () => {
            throw new Error('Not implemented (and {time} is not implemented)');
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

function ProFeatures() {
  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription title={{ token: 'proFeatures' }} />
      <PanelButtonGroup>PLOP</PanelButtonGroup>
    </SectionFlexContainer>
  );
}

function ManagePro() {
  return (
    <SectionFlexContainer>
      <PanelLabelWithDescription title={{ token: 'managePro' }} />
      <PanelButtonGroup>
        <PanelIconButton
          text={{ token: 'cancelPlan' }}
          dataTestId="cancel-pro-button"
          onClick={() => {}}
          color={'var(--danger-color)'}
          iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.CIRCLE_X} />}
        />
        <PanelIconButton
          text={{ token: 'requestRefund' }}
          dataTestId="request-refund-button"
          onClick={() => {}}
          color={'var(--danger-color)'}
          iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.CIRCLE_ALERT} />}
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
            showLinkVisitWarningDialog('https://getsession.org/pro-roadmap', dispatch)
          }
        />
        <SettingsExternalLinkBasic
          baseDataTestId="pro-support"
          text={{ token: 'helpSupport' }}
          subText={{ token: 'proSupportDescription' }}
          onClick={async () =>
            showLinkVisitWarningDialog('https://getsession.org/pro-roadmap', dispatch)
          }
        />
      </PanelButtonGroup>
    </SectionFlexContainer>
  );
}

export function ProSettingsPage(modalState: UserSettingsModalState) {
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);

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
        <ProHeroImage />
        <ProStats />
        <ProSettings />
        <ProFeatures />
        <ManagePro />
        <ProHelp />
      </ModalFlexContainer>
    </UserSettingsModalContainer>
  );
}
