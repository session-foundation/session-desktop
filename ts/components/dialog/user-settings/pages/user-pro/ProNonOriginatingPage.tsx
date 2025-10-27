import styled from 'styled-components';
import { type ReactNode } from 'react';
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
import type { ProNonOriginatingPageVariant } from '../../../../../types/ReduxTypes';
import { ProOriginatingPlatform, useProAccessDetails } from '../../../../../hooks/useHasPro';

type VariantPageProps = {
  variant: ProNonOriginatingPageVariant;
};

function ProStatusTextUpdate() {
  const { data } = useProAccessDetails();
  return data.autoRenew ? (
    <Localizer
      token="proAccessActivatedAutoShort"
      current_plan_length={data.variantString}
      date={data.expiryTimeDateString}
    />
  ) : (
    <Localizer token="proAccessExpireDate" date={data.expiryTimeDateString} />
  );
}

function ProPageHero({ variant }: VariantPageProps) {
  switch (variant) {
    case 'upgrade':
      return <ProHeroImage heroText={tr('proUpgradeAccess')} />;
    case 'update':
      return <ProHeroImage heroText={<ProStatusTextUpdate />} />;
    case 'renew':
      return <ProHeroImage heroText={tr('proAccessRenewStart')} />;
    case 'cancel':
      return <ProHeroImage heroText={tr('proCancelSorry')} noColors={true} />;
    case 'refund':
      return <ProHeroImage heroText={tr('proRefundDescription')} noColors={true} />;
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
        background: 'var(--background-tertiary-color)',
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
  const { data } = useProAccessDetails();
  return (
    <ProInfoBlockItem
      iconElement={<ProInfoBlockIconElement unicode={LUCIDE_ICONS_UNICODE.SMARTPHONE} />}
      textElement={
        <ProInfoBlockText>
          <strong>{tr('onDevice', { device_type: data.platformStrings.device_type })}</strong>
          {textElement}
        </ProInfoBlockText>
      }
    />
  );
}

function ProInfoBlockDeviceLinked() {
  const { data } = useProAccessDetails();
  return (
    <ProInfoBlockItem
      iconElement={<ProInfoBlockIconElement unicode={LUCIDE_ICONS_UNICODE.LINK} />}
      textElement={
        <ProInfoBlockText>
          <strong>{tr('onLinkedDevice')}</strong>
          <Localizer
            token="proRenewDesktopLinked"
            platform_store={data.platformStrings.platform_store}
            platform_store_other={data.platformStrings.platform_store_other}
          />
        </ProInfoBlockText>
      }
    />
  );
}

function ProInfoBlockWebsite({ textElement }: { textElement: ReactNode }) {
  const { data } = useProAccessDetails();
  return (
    <ProInfoBlockItem
      iconElement={<ProInfoBlockIconElement unicode={LUCIDE_ICONS_UNICODE.GLOBE} />}
      textElement={
        <ProInfoBlockText>
          <strong>{tr('viaStoreWebsite', { platform: data.platformStrings.platform })}</strong>
          {textElement}
        </ProInfoBlockText>
      }
    />
  );
}

function ProInfoBlockLayout({
  titleElement,
  descriptionElement,
  descriptionOnClick,
  subtitleElement,
  blockItems,
}: {
  titleElement: ReactNode;
  descriptionElement: ReactNode;
  descriptionOnClick?: () => void;
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
      <ProInfoBlockDescription
        onClick={descriptionOnClick}
        style={{ cursor: descriptionOnClick ? 'pointer' : 'default' }}
      >
        {descriptionElement}
      </ProInfoBlockDescription>
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
  const dispatch = useDispatch();
  const { data } = useProAccessDetails();
  return (
    <ProInfoBlockLayout
      titleElement={tr('proUpgradingTo')}
      descriptionElement={
        <Localizer
          token="proAccessUpgradeDesktop"
          platform_store={data.platformStrings.platform_store}
          platform_store_other={data.platformStrings.platform_store_other}
          icon={LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON}
        />
      }
      descriptionOnClick={() =>
        showLinkVisitWarningDialog('https://getsession.org/pro-roadmap', dispatch)
      }
      subtitleElement={
        <ProInfoBlockSectionSubtitle>{tr('proUpgradeOption')}</ProInfoBlockSectionSubtitle>
      }
      blockItems={<ProInfoBlockDeviceLinked />}
    />
  );
}

function ProInfoBlockUpdate() {
  const { data } = useProAccessDetails();
  return (
    <ProInfoBlockLayout
      titleElement={tr('updateAccess')}
      descriptionElement={
        <Localizer
          token="proAccessSignUp"
          platform_account={data.platformStrings.platform_account}
          platform_store={data.platformStrings.platform_store}
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
                device_type={data.platformStrings.device_type}
                platform_account={data.platformStrings.platform_account}
              />
            }
          />
          <ProInfoBlockWebsite
            textElement={
              <Localizer
                token="viaStoreWebsiteDescription"
                platform_store={data.platformStrings.platform}
                platform_account={data.platformStrings.platform_account}
              />
            }
          />
        </>
      }
    />
  );
}

function ProInfoBlockRenew() {
  const { data } = useProAccessDetails();
  return (
    <ProInfoBlockLayout
      titleElement={tr('renewingPro')}
      descriptionElement={
        <Localizer
          token="proAccessRenewDesktop"
          platform_store={data.platformStrings.platform_store}
          platform_store_other={data.platformStrings.platform_store_other}
          icon={LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON}
        />
      }
      subtitleElement={
        <ProInfoBlockSectionSubtitle>
          {tr('proOptionsTwoRenewalSubtitle')}
        </ProInfoBlockSectionSubtitle>
      }
      blockItems={
        <>
          <ProInfoBlockDeviceLinked />
          <ProInfoBlockWebsite
            textElement={
              <Localizer
                token="proAccessRenewPlatformStoreWebsite"
                platform_store={data.platformStrings.platform}
                platform_account={data.platformStrings.platform_account}
              />
            }
          />
        </>
      }
    />
  );
}

function ProInfoBlockCancel() {
  const { data } = useProAccessDetails();
  return (
    <ProInfoBlockLayout
      titleElement={tr('proCancellation')}
      descriptionElement={
        <Localizer
          token="proCancellationDescription"
          platform_account={data.platformStrings.platform_account}
        />
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
                device_type={data.platformStrings.device_type}
                platform_account={data.platformStrings.platform_account}
              />
            }
          />
          <ProInfoBlockWebsite
            textElement={
              <Localizer
                token="cancelProPlatformStore"
                platform_store={data.platformStrings.platform}
                platform_account={data.platformStrings.platform_account}
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

function ProInfoBlockRefundSessionSupport() {
  return (
    <PanelButtonGroup
      containerStyle={{
        paddingBlock: 'var(--margins-md)',
        paddingInline: 'var(--margins-lg)',
        gap: 'var(--margins-sm)',
      }}
    >
      <ProInfoBlockRefundTitle>
        <Localizer token="proRefunding" />
      </ProInfoBlockRefundTitle>
      <Localizer token="proRefundRequestSessionSupport" />
      <ProInfoBlockRefundTitle>
        <Localizer token="important" />
      </ProInfoBlockRefundTitle>
      <Localizer token="proImportantDescription" />
    </PanelButtonGroup>
  );
}

function ProInfoBlockRefundGooglePlay() {
  const { data } = useProAccessDetails();
  return (
    <PanelButtonGroup
      containerStyle={{
        paddingBlock: 'var(--margins-md)',
        paddingInline: 'var(--margins-lg)',
        gap: 'var(--margins-sm)',
      }}
    >
      <ProInfoBlockRefundTitle>
        <Localizer token="proRefunding" />
      </ProInfoBlockRefundTitle>
      <Localizer token="proRefundRequestStorePolicies" platform={data.platformStrings.platform} />
      <ProInfoBlockRefundTitle>
        <Localizer token="important" />
      </ProInfoBlockRefundTitle>
      <Localizer token="proImportantDescription" />
    </PanelButtonGroup>
  );
}

function ProInfoBlockRefundIOS() {
  const { data } = useProAccessDetails();
  return (
    <ProInfoBlockLayout
      titleElement={tr('proRefunding')}
      descriptionElement={
        <Localizer
          token="proPlanPlatformRefund"
          platform_store={data.platformStrings.platform_store}
          platform_account={data.platformStrings.platform_account}
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
                device_type={data.platformStrings.device_type}
                platform_account={data.platformStrings.platform_account}
              />
            }
          />
          <ProInfoBlockWebsite
            textElement={
              <Localizer
                token="requestRefundPlatformWebsite"
                platform={data.platformStrings.platform}
                platform_account={data.platformStrings.platform_account}
              />
            }
          />
        </>
      }
    />
  );
}

function ProInfoBlockRefund() {
  const { data } = useProAccessDetails();

  if (!data.isPlatformRefundAvailable) {
    return <ProInfoBlockRefundSessionSupport />;
  }

  switch (data.platform) {
    case ProOriginatingPlatform.iOSAppStore:
      return <ProInfoBlockRefundIOS />;
    case ProOriginatingPlatform.GooglePlayStore:
      return <ProInfoBlockRefundGooglePlay />;
    case ProOriginatingPlatform.Nil:
      return <ProInfoBlockRefundSessionSupport />;
    default:
      return assertUnreachable(data.platform, `Unknown pro originating platform: ${data.platform}`);
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
  const dispatch = useDispatch();
  const { data } = useProAccessDetails();
  return (
    <SessionButton
      {...proButtonProps}
      buttonColor={SessionButtonColor.PrimaryDark}
      onClick={() => {
        showLinkVisitWarningDialog(data.platformStrings.platform_link_manage, dispatch);
      }}
      dataTestId="pro-open-platform-website-button"
    >
      <Localizer token="openPlatformWebsite" platform={data.platformStrings.platform} />
    </SessionButton>
  );
}

function ProPageButtonCancel() {
  const dispatch = useDispatch();
  const { data } = useProAccessDetails();
  return (
    <SessionButton
      {...proButtonProps}
      buttonColor={SessionButtonColor.Danger}
      onClick={() => {
        showLinkVisitWarningDialog(data.platformStrings.platform_link_cancel, dispatch);
      }}
      dataTestId="pro-open-platform-website-button"
    >
      <Localizer token="openPlatformWebsite" platform={data.platformStrings.platform} />
    </SessionButton>
  );
}

function ProPageButtonRefund() {
  const dispatch = useDispatch();
  const { data } = useProAccessDetails();
  return (
    <SessionButton
      {...proButtonProps}
      buttonColor={SessionButtonColor.Danger}
      onClick={() => {
        showLinkVisitWarningDialog(
          data.isPlatformRefundAvailable
            ? data.platformStrings.platform_link_refund
            : data.platformStrings.session_support_link_refund,
          dispatch
        );
      }}
      dataTestId="pro-open-platform-website-button"
    >
      {data.isPlatformRefundAvailable ? (
        <Localizer token="openPlatformWebsite" platform={data.platformStrings.platform} />
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
  overrideBackAction?: () => void;
  centerAlign?: boolean;
}) {
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);

  const backOnClick = modalState.overrideBackAction || backAction;

  return (
    <UserSettingsModalContainer
      headerChildren={
        <ModalBasicHeader
          title={null}
          bigHeader={true}
          showExitIcon={true}
          extraLeftButton={backOnClick ? <ModalBackButton onClick={backOnClick} /> : undefined}
        />
      }
      onClose={closeAction || undefined}
      centerAlign={modalState.centerAlign}
    >
      <ModalFlexContainer>
        <ProPageHero variant={modalState.nonOriginatingVariant} />
        <ProInfoBlock variant={modalState.nonOriginatingVariant} />
        <ProPageButton variant={modalState.nonOriginatingVariant} />
      </ModalFlexContainer>
    </UserSettingsModalContainer>
  );
}
