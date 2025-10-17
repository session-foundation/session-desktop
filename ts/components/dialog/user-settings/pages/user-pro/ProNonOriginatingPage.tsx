import styled from 'styled-components';
import { ReactNode, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { tr } from '../../../../../localization/localeTools';
import { Localizer } from '../../../../basic/Localizer';
import { ModalBasicHeader } from '../../../../SessionWrapperModal';
import { ModalBackButton } from '../../../shared/ModalBackButton';
import { ModalFlexContainer } from '../../../shared/ModalFlexContainer';
import { UserSettingsModalContainer } from '../../components/UserSettingsModalContainer';
import { useUserSettingsBackAction, useUserSettingsCloseAction } from '../userSettingsHooks';
import { ProHeroImage } from './ProSettingsPage';
import { assertUnreachable } from '../../../../../types/sqlSharedTypes';
import { PanelButtonGroup } from '../../../../buttons';
import { StyledContent } from '../../../../buttons/panel/PanelButton';
import { LucideIcon } from '../../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE, WithLucideUnicode } from '../../../../icon/lucide';
import { SessionButton, SessionButtonColor } from '../../../../basic/SessionButton';
import { showLinkVisitWarningDialog } from '../../../OpenUrlModal';
import { proButtonProps } from '../../../SessionProInfoModal';
import { Flex } from '../../../../basic/Flex';

type ProNonOriginatingPageVariant = 'upgrade' | 'update' | 'cancel' | 'refund' | 'renew';

type VariantPageProps = {
  variant: ProNonOriginatingPageVariant;
};

function ProStatusTextUpdate() {
  // TODO: get pro details from settings
  const isAutoRenewing = true;
  const currentPlan = '3 Months';
  const expiryTimeString = 'May 21, 2025';

  return isAutoRenewing ? (
    <Localizer
      token="proAccessActivatedAutoShort"
      current_plan={currentPlan}
      date={expiryTimeString}
    />
  ) : (
    <Localizer token="proAccessActivatedNotAuto" date={expiryTimeString} />
  );
}

function ProPageHero({ variant }: VariantPageProps) {
  switch (variant) {
    case 'upgrade':
      // TODO: this is not the right string in figma, check this
      return <ProHeroImage heroText={tr('proUserProfileModalCallToAction')} />;
    case 'update':
      return <ProHeroImage heroText={<ProStatusTextUpdate />} />;
    case 'renew':
      return <ProHeroImage heroText={tr('proAccessRenewStart')} />;
    case 'cancel':
      return <ProHeroImage noColors heroText={tr('proCancelSorry')} />;
    case 'refund':
      return <ProHeroImage noColors heroText={tr('proRefundDescription')} />;
    default:
      return assertUnreachable(variant, `Unknown pro non originating page variant: ${variant}`);
  }
}

const ProInfoBlockTitle = styled.div`
  font-size: var(--font-size-xl);
  line-height: var(--font-size-xl);
  font-weight: 700;
`;

const ProInfoBlockDescription = styled.div`
  font-size: var(--font-size-md);
  line-height: var(--font-size-md);
`;

const ProInfoBlockSectionSubtitle = styled.div`
  font-size: var(--font-size-md);
  line-height: var(--font-size-md);
  color: var(--text-secondary-color);
`;

function ProInfoBlockItem({
  textElement,
  iconElement,
}: {
  iconElement: ReactNode;
  textElement: ReactNode;
}) {
  return (
    <PanelButtonGroup
      containerStyle={{
        padding: 'var(--margins-md)',
        background: 'var(--chat-buttons-background-hover-color)',
      }}
    >
      <StyledContent style={{ gap: 'var(--margins-md)', alignItems: 'flex-start' }}>
        {iconElement}
        {textElement}
      </StyledContent>
    </PanelButtonGroup>
  );
}

const StyledBlockItemIcon = styled.div`
  display: flex;
  justify-content: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: var(--margins-xs);
  color: var(--primary-color);
`;

function ProInfoBlockIconElement({ unicode }: WithLucideUnicode) {
  return (
    <Flex
      $container={true}
      $alignItems={'center'}
      $justifyContent={'center'}
      $flexGap="var(--margins-sm)"
    >
      <StyledBlockItemIcon
        style={{ background: 'color-mix(in srgb, var(--primary-color) 10%, transparent)' }}
      >
        <LucideIcon unicode={unicode} iconSize={'large'} />
      </StyledBlockItemIcon>
    </Flex>
  );
}

const ProInfoBlockText = styled.div`
  display: flex;
  flex-direction: column;
  align-items: start;
  text-align: start;
  gap: var(--margins-xs);
`;

function ProInfoBlockDevice({ textElement }: { textElement: ReactNode }) {
  // TODO: get these from settings
  const deviceType = 'Android';

  return (
    <ProInfoBlockItem
      iconElement={<ProInfoBlockIconElement unicode={LUCIDE_ICONS_UNICODE.SMARTPHONE} />}
      textElement={
        <ProInfoBlockText>
          <strong>{tr('onDevice', { device_type: deviceType })}</strong>
          {textElement}
        </ProInfoBlockText>
      }
    />
  );
}

function ProInfoBlockDeviceLinked() {
  // TODO: get these from settings
  const platformStore = 'Google Play Store';
  const platformStoreOther = 'Apple App Store';

  return (
    <ProInfoBlockItem
      iconElement={<ProInfoBlockIconElement unicode={LUCIDE_ICONS_UNICODE.LINK} />}
      textElement={
        <ProInfoBlockText>
          <strong>{tr('onLinkedDevice')}</strong>
          <Localizer
            token="proRenewDesktopLinked"
            platform_store={platformStore}
            platform_store_other={platformStoreOther}
          />
        </ProInfoBlockText>
      }
    />
  );
}

function ProInfoBlockWebsite({ textElement }: { textElement: ReactNode }) {
  // TODO: get these from settings
  const platform = 'Google';

  return (
    <ProInfoBlockItem
      iconElement={<ProInfoBlockIconElement unicode={LUCIDE_ICONS_UNICODE.GLOBE} />}
      textElement={
        <ProInfoBlockText>
          <strong>{tr('viaStoreWebsite', { platform })}</strong>
          {textElement}
        </ProInfoBlockText>
      }
    />
  );
}

function ProInfoBlockLayout({
  titleElement,
  descriptionElement,
  subtitleElement,
  blockItems,
}: {
  titleElement: ReactNode;
  descriptionElement: ReactNode;
  subtitleElement: ReactNode;
  blockItems: ReactNode;
}) {
  return (
    <PanelButtonGroup
      containerStyle={{
        paddingBlock: 'var(--margins-lg)',
        paddingInline: 'var(--margins-lg)',
        gap: 'var(--margins-sm)',
      }}
    >
      <ProInfoBlockTitle>{titleElement}</ProInfoBlockTitle>
      <ProInfoBlockDescription>{descriptionElement}</ProInfoBlockDescription>
      <ProInfoBlockSectionSubtitle>{subtitleElement}</ProInfoBlockSectionSubtitle>
      <PanelButtonGroup
        containerStyle={{ marginBlock: 'var(--margins-xs)', gap: 'var(--margins-sm)' }}
      >
        {blockItems}
      </PanelButtonGroup>
    </PanelButtonGroup>
  );
}

function ProInfoBlockUpgrade() {
  // TODO: get these from settings
  const platformStore = 'Google Play Store';
  const platformStoreOther = 'Apple App Store';

  // TODO: put real strings here
  return (
    <ProInfoBlockLayout
      titleElement={tr('renewingPro')}
      descriptionElement={
        <Localizer
          token="proPlanRenewDesktop"
          platform_store={platformStore}
          platform_store_other={platformStoreOther}
          icon={LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON}
        />
      }
      subtitleElement={
        <ProInfoBlockSectionSubtitle>{tr('proOptionsRenewalSubtitle')}</ProInfoBlockSectionSubtitle>
      }
      blockItems={<ProInfoBlockDeviceLinked />}
    />
  );
}

function ProInfoBlockUpdate() {
  // TODO: get these from settings
  const platform = 'Google';
  const platformStore = 'Google Play Store';
  const platformAccount = 'Google Account';
  const deviceType = 'Android';

  return (
    <ProInfoBlockLayout
      titleElement={tr('updateAccess')}
      descriptionElement={
        <Localizer
          token="proAccessSignUp"
          platform_account={platformAccount}
          platform_store={platformStore}
        />
      }
      subtitleElement={
        <ProInfoBlockSectionSubtitle>{tr('updateAccessTwo')}</ProInfoBlockSectionSubtitle>
      }
      blockItems={
        <>
          <ProInfoBlockDevice
            textElement={
              <Localizer
                token="onDeviceDescription"
                device_type={deviceType}
                platform_account={platformAccount}
              />
            }
          />
          <ProInfoBlockWebsite
            textElement={
              <Localizer
                token="viaStoreWebsiteDescription"
                platform_store={platform}
                platform_account={platformAccount}
              />
            }
          />
        </>
      }
    />
  );
}

function ProInfoBlockRenew() {
  // TODO: get these from settings
  const platform = 'Google';
  const platformAccount = 'Google Account';

  const platformStore = 'Google Play Store';
  const platformStoreOther = 'Apple App Store';

  return (
    <ProInfoBlockLayout
      titleElement={tr('renewingPro')}
      descriptionElement={
        <Localizer
          token="proPlanRenewDesktop"
          platform_store={platformStore}
          platform_store_other={platformStoreOther}
          icon={LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON}
        />
      }
      subtitleElement={
        <ProInfoBlockSectionSubtitle>{tr('proOptionsRenewalSubtitle')}</ProInfoBlockSectionSubtitle>
      }
      blockItems={
        <>
          <ProInfoBlockDeviceLinked />
          <ProInfoBlockWebsite
            textElement={
              <Localizer
                token="proAccessRenewPlatformStoreWebsite"
                platform_store={platform}
                platform_account={platformAccount}
              />
            }
          />
        </>
      }
    />
  );
}

function ProInfoBlockCancel() {
  // TODO: get these from settings
  const platform = 'Google';
  const platformAccount = 'Google Account';
  const deviceType = 'Android';
  return (
    <ProInfoBlockLayout
      titleElement={tr('cancelAccess')}
      descriptionElement={
        <Localizer token="proCancellationDescription" platform_account={platformAccount} />
      }
      subtitleElement={
        <ProInfoBlockSectionSubtitle>{tr('proCancellationOptions')}</ProInfoBlockSectionSubtitle>
      }
      blockItems={
        <>
          <ProInfoBlockDevice
            textElement={
              <Localizer
                token="onDeviceCancelDescription"
                device_type={deviceType}
                platform_account={platformAccount}
              />
            }
          />
          <ProInfoBlockWebsite
            textElement={
              <Localizer
                token="cancelProPlatformStore"
                platform_store={platform}
                platform_account={platformAccount}
              />
            }
          />
        </>
      }
    />
  );
}

const ProInfoBlockRefundTitle = styled.div`
  font-size: var(--font-size-lg);
  line-height: var(--font-size-lg);
  font-weight: 700;
  padding-top: var(--margins-xs);
`;

function ProInfoBlockRefundAndroid() {
  // TODO: get these from settings
  const platform = 'Android';
  const platformRefundExpiryUnixTsMs = 0;
  const now = useMemo(() => Date.now(), []);
  return (
    <PanelButtonGroup
      containerStyle={{
        paddingBlock: 'var(--margins-md)',
        paddingInline: 'var(--margins-lg)',
        gap: 'var(--margins-sm)',
      }}
    >
      <ProInfoBlockRefundTitle>
        <Localizer token="proRefunding" />{' '}
      </ProInfoBlockRefundTitle>
      {platformRefundExpiryUnixTsMs > now ? (
        <Localizer token="proRefundRequestStorePolicies" platform={platform} />
      ) : (
        <Localizer token="proRefundRequestSessionSupport" />
      )}
      <ProInfoBlockRefundTitle>
        <Localizer token="important" />
      </ProInfoBlockRefundTitle>
      <Localizer token="proImportantDescription" />
    </PanelButtonGroup>
  );
}

function ProInfoBlockRefundIOS() {
  // TODO: get these from settings
  const platform = 'Apple';
  const platformAccount = 'Apple account';
  const platformStore = 'Apple App Store';
  const deviceType = 'iOS';
  return (
    <ProInfoBlockLayout
      titleElement={tr('proRefunding')}
      descriptionElement={
        <Localizer
          token="proPlanPlatformRefund"
          platform_store={platformStore}
          platform_account={platformAccount}
        />
      }
      subtitleElement={
        <ProInfoBlockSectionSubtitle>{tr('refundRequestOptions')}</ProInfoBlockSectionSubtitle>
      }
      blockItems={
        <>
          <ProInfoBlockDevice
            textElement={
              <Localizer
                token="proRefundAccountDevice"
                device_type={deviceType}
                platform_account={platformAccount}
              />
            }
          />
          <ProInfoBlockWebsite
            textElement={
              <Localizer
                token="requestRefundPlatformWebsite"
                platform={platform}
                platform_account={platformAccount}
              />
            }
          />
        </>
      }
    />
  );
}

function ProInfoBlockRefund() {
  // TODO: get these from settings
  const platform = 'Apple' as 'Apple' | 'Android';

  switch (platform) {
    case 'Apple':
      return <ProInfoBlockRefundIOS />;
    case 'Android':
      return <ProInfoBlockRefundAndroid />;
    default:
      return assertUnreachable(platform, `Unknown pro platform: ${platform}`);
  }
}

function ProInfoBlock({ variant }: VariantPageProps) {
  switch (variant) {
    case 'upgrade':
      return <ProInfoBlockUpgrade />;
    case 'update':
      return <ProInfoBlockUpdate />;
    case 'cancel':
      return <ProInfoBlockCancel />;
    case 'refund':
      return <ProInfoBlockRefund />;
    case 'renew':
      return <ProInfoBlockRenew />;
    default:
      return assertUnreachable(variant, `Unknown pro non originating page variant: ${variant}`);
  }
}

function ProPageButtonUpdate() {
  // TODO: get these from settings
  const platform = 'Google';
  const platformLink = 'https://google.com/';

  const dispatch = useDispatch();

  return (
    <SessionButton
      {...proButtonProps}
      buttonColor={SessionButtonColor.PrimaryDark}
      onClick={() => {
        showLinkVisitWarningDialog(platformLink, dispatch);
      }}
      dataTestId="pro-open-platform-website-button"
    >
      <Localizer token="openPlatformWebsite" platform={platform} />
    </SessionButton>
  );
}

function ProPageButtonCancel() {
  // TODO: get these from settings
  const platform = 'Google';
  const platformLink = 'https://google.com/';

  const dispatch = useDispatch();

  return (
    <SessionButton
      {...proButtonProps}
      buttonColor={SessionButtonColor.Danger}
      onClick={() => {
        showLinkVisitWarningDialog(platformLink, dispatch);
      }}
      dataTestId="pro-open-platform-website-button"
    >
      <Localizer token="openPlatformWebsite" platform={platform} />
    </SessionButton>
  );
}

function ProPageButtonRefund() {
  // TODO: get these from settings
  const platform = 'Google';
  const refundLink = 'https://google.com/';
  const platformRefundExpiryUnixTsMs = 0;
  const now = useMemo(() => Date.now(), []);

  const dispatch = useDispatch();

  return (
    <SessionButton
      {...proButtonProps}
      buttonColor={SessionButtonColor.Danger}
      onClick={() => {
        showLinkVisitWarningDialog(refundLink, dispatch);
      }}
      dataTestId="pro-open-platform-website-button"
    >
      {platformRefundExpiryUnixTsMs > now ? (
        <Localizer token="openPlatformWebsite" platform={platform} />
      ) : (
        <Localizer token="requestRefund" />
      )}
    </SessionButton>
  );
}

function ProPageButton({ variant }: VariantPageProps) {
  switch (variant) {
    case 'upgrade':
      return null;
    case 'update':
    case 'renew':
      return <ProPageButtonUpdate />;
    case 'cancel':
      return <ProPageButtonCancel />;
    case 'refund':
      return <ProPageButtonRefund />;
    default:
      return assertUnreachable(variant, `Unknown pro non originating page variant: ${variant}`);
  }
}

export function ProNonOriginatingPage(modalState: {
  userSettingsPage: 'proNonOriginating';
  nonOriginatingVariant: ProNonOriginatingPageVariant;
}) {
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
      onClose={
        modalState.nonOriginatingVariant === 'upgrade'
          ? backAction || undefined
          : closeAction || undefined
      }
    >
      <ModalFlexContainer>
        <ProPageHero variant={modalState.nonOriginatingVariant} />
        <ProInfoBlock variant={modalState.nonOriginatingVariant} />
        <ProPageButton variant={modalState.nonOriginatingVariant} />
      </ModalFlexContainer>
    </UserSettingsModalContainer>
  );
}
