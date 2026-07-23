import styled from 'styled-components';
import { type ReactNode, useEffect, useState } from 'react';
import { getAppDispatch } from '../../../../../state/dispatch';
import { isSimpleTokenNoArgs, tr } from '../../../../../localization/localeTools';
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
import { ProWrapperActions } from '../../../../../webworker/workers/browser/libsession_worker_interface';
import type { ProviderUrls } from 'libsession_util_nodejs';
import { proButtonProps } from '../../../SessionCTA';
import { Flex } from '../../../../basic/Flex';
import type { ProNonOriginatingPageVariant } from '../../../../../types/ReduxTypes';
import { useCurrentNeverHadPro } from '../../../../../hooks/useHasPro';
import LIBSESSION_CONSTANTS from '../../../../../session/utils/libsession/libsession_constants';
import { ProPaymentProvider } from '../../../../../session/apis/pro_backend_api/types';
import {
  useProBackendProStatus,
  type ProcessedProStatus,
} from '../../../../../state/selectors/proBackendData';
import { userSettingsModal } from '../../../../../state/ducks/modalDialog';

type VariantPageProps = {
  variant: ProNonOriginatingPageVariant;
};

const useProBackendProStatusLocal = useProBackendProStatus;

/**
 * Provider support/management URLs are libsession's (fetched by provider slug), not client display data,
 * so we resolve them on demand at click time via the worker rather than threading async state into the
 * (synchronous) selector. `pick` chooses which URL from the resolved set.
 */
async function openProviderUrl(
  provider: ProPaymentProvider,
  pick: (urls: ProviderUrls) => string,
  dispatch: Parameters<typeof showLinkVisitWarningDialog>[1]
) {
  const urls = await ProWrapperActions.providerUrls({ code: provider });
  if (!urls) {
    return;
  }
  // A provider may expose only some URLs; libsession returns '' for an absent one. Guard on the
  // picked URL (not just the container) so we never open the link-visit dialog on an empty string.
  const url = pick(urls);
  if (url) {
    showLinkVisitWarningDialog(url, dispatch);
  }
}
const useCurrentNeverHadProLocal = useCurrentNeverHadPro;

/**
 * For some texts, we want `Apple website` for apple but `Google Play Store website` for google...
 * Those two are not stored in the same field, so this hook can be used to fetch the right one
 */
function useStoreOrPlatformFromProvider(data: ProcessedProStatus['data']) {
  return data.provider === ProPaymentProvider.AppStore
    ? data.providerConstants.platform // we want `Apple website` for apple
    : data.providerConstants.store; // but `Google Play Store website` for google...
}

// The purchasable-platform slug set is a static libsession constant, so fetch it once and cache it.
let cachedVisiblePlatformSlugs: Array<string> | null = null;

/**
 * Build the `{pro_stores}` bulleted list from the purchasable provider slugs, keeping only those with a
 * `pro_provider_<slug>_store` translation (a new/untranslated provider is skipped gracefully). Desktop
 * keeps libsession's order as-is (it has no "own" platform to hoist).
 */
function buildProStoresList(slugs: Array<string>): string {
  return slugs
    .map(slug => {
      const token = `pro_provider_${slug}_store`;
      return isSimpleTokenNoArgs(token) ? tr(token) : undefined;
    })
    .filter((store): store is string => !!store)
    .map(store => `<br/>• ${store}`)
    .join('');
}

/** The localized `{pro_stores}` list for the "purchase via …" messages (fetched once; empty until loaded). */
function useProStoresList(): string {
  const [slugs, setSlugs] = useState<Array<string>>(cachedVisiblePlatformSlugs ?? []);
  useEffect(() => {
    if (cachedVisiblePlatformSlugs) {
      return undefined;
    }
    let cancelled = false;
    void ProWrapperActions.visiblePlatforms().then(result => {
      cachedVisiblePlatformSlugs = result;
      if (!cancelled) {
        setSlugs(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return buildProStoresList(slugs);
}

function ProStatusTextUpdate() {
  const { data } = useProBackendProStatusLocal();
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
    case 'refundRequested':
      return <ProHeroImage heroText={tr('proRequestedRefund')} noColors={true} />;
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
`;

const ProInfoBlockSectionSubtitle = styled.div`
  font-size: var(--font-size-md);
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
      withBorder={true}
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
  box-shadow: var(--button-drop-shadow);
`;

function ProInfoBlockIconElement({ unicode }: WithLucideUnicode) {
  return (
    <Flex
      $container={true}
      $alignItems={'center'}
      $justifyContent={'center'}
      $flexGap="var(--margins-sm)"
    >
      <StyledBlockItemIcon style={{ background: 'var(--accent-icon-background-color)' }}>
        <LucideIcon
          unicode={unicode}
          iconSize={'large'}
          iconColor={'var(--accent-icon-fill-color)'}
        />
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
  const { data } = useProBackendProStatusLocal();
  return (
    <ProInfoBlockItem
      iconElement={<ProInfoBlockIconElement unicode={LUCIDE_ICONS_UNICODE.SMARTPHONE} />}
      textElement={
        <ProInfoBlockText>
          <strong>{tr('onDevice', { device_type: data.providerConstants.device })}</strong>
          {textElement}
        </ProInfoBlockText>
      }
    />
  );
}

function ProInfoBlockDeviceLinked() {
  const hasNeverHadPro = useCurrentNeverHadProLocal();
  const proStores = useProStoresList();

  return (
    <ProInfoBlockItem
      iconElement={<ProInfoBlockIconElement unicode={LUCIDE_ICONS_UNICODE.LINK} />}
      textElement={
        <ProInfoBlockText>
          <strong>{tr('onLinkedDevice')}</strong>
          <Localizer
            token={hasNeverHadPro ? 'proUpgradeDesktopLinked' : 'proRenewDesktopLinked'}
            pro_stores={proStores}
          />
        </ProInfoBlockText>
      }
    />
  );
}

function ProInfoBlockWebsite({
  textElement,
  titleType,
}: {
  textElement: ReactNode;
  titleType: 'via' | 'onThe';
}) {
  const { data } = useProBackendProStatusLocal();
  const storeOrPlatform = useStoreOrPlatformFromProvider(data);

  return (
    <ProInfoBlockItem
      iconElement={<ProInfoBlockIconElement unicode={LUCIDE_ICONS_UNICODE.GLOBE} />}
      textElement={
        <ProInfoBlockText>
          <strong>
            {tr(titleType === 'via' ? 'viaStoreWebsite' : 'onPlatformWebsite', {
              platform: storeOrPlatform,
            })}
          </strong>
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
  const dispatch = getAppDispatch();
  const proStores = useProStoresList();
  return (
    <ProInfoBlockLayout
      titleElement={tr('proUpgradingTo')}
      descriptionElement={
        <Localizer
          token="proAccessUpgradeDesktop"
          pro_stores={proStores}
          icon={LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON}
        />
      }
      descriptionOnClick={() =>
        showLinkVisitWarningDialog(LIBSESSION_CONSTANTS.LIBSESSION_PRO_URLS.roadmap, dispatch)
      }
      subtitleElement={
        <ProInfoBlockSectionSubtitle>{tr('proUpgradeOption')}</ProInfoBlockSectionSubtitle>
      }
      blockItems={<ProInfoBlockDeviceLinked />}
    />
  );
}

function ProInfoBlockUpdate() {
  const { data } = useProBackendProStatusLocal();
  const storeOrPlatform = useStoreOrPlatformFromProvider(data);

  return (
    <ProInfoBlockLayout
      titleElement={tr('updateAccess')}
      descriptionElement={
        <Localizer
          token="proAccessSignUp"
          platform_account={data.providerConstants.platform_account}
          platform_store={data.providerConstants.store}
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
                device_type={data.providerConstants.device}
                platform_account={data.providerConstants.platform_account}
              />
            }
          />
          <ProInfoBlockWebsite
            titleType="via"
            textElement={
              <Localizer
                token="viaStoreWebsiteDescription"
                platform_store={storeOrPlatform}
                platform_account={data.providerConstants.platform_account}
              />
            }
          />
        </>
      }
    />
  );
}

function ProInfoBlockRenew() {
  const dispatch = getAppDispatch();
  const { data } = useProBackendProStatusLocal();
  const storeOrPlatform = useStoreOrPlatformFromProvider(data);
  const proStores = useProStoresList();

  return (
    <ProInfoBlockLayout
      titleElement={tr('renewingPro')}
      descriptionElement={
        <Localizer
          token="proAccessRenewDesktop"
          pro_stores={proStores}
          icon={LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON}
        />
      }
      descriptionOnClick={() =>
        showLinkVisitWarningDialog('https://getsession.org/pro-roadmap', dispatch)
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
            titleType="onThe"
            textElement={
              <Localizer
                token="proAccessRenewPlatformStoreWebsite"
                platform_store={storeOrPlatform}
                platform_account={data.providerConstants.platform_account}
              />
            }
          />
        </>
      }
    />
  );
}

function ProInfoBlockCancel() {
  const { data } = useProBackendProStatusLocal();
  const storeOrPlatform = useStoreOrPlatformFromProvider(data);

  return (
    <ProInfoBlockLayout
      titleElement={tr('proCancellation')}
      descriptionElement={
        <Localizer
          token="proCancellationDescription"
          platform_account={data.providerConstants.platform_account}
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
                device_type={data.providerConstants.device}
                platform_account={data.providerConstants.platform_account}
              />
            }
          />
          <ProInfoBlockWebsite
            titleType="onThe"
            textElement={
              <Localizer
                token="cancelProPlatformStore"
                platform_store={storeOrPlatform}
                platform_account={data.providerConstants.platform_account}
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
const containerStyle = {
  paddingBlock: 'var(--margins-md)',
  paddingInline: 'var(--margins-lg)',
  gap: 'var(--margins-sm)',
  lineHeight: '120%',
};

function ProInfoBlockRefundSessionSupport() {
  return (
    <PanelButtonGroup containerStyle={containerStyle}>
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
  const { data } = useProBackendProStatusLocal();
  return (
    <PanelButtonGroup containerStyle={containerStyle}>
      <ProInfoBlockRefundTitle>
        <Localizer token="proRefunding" />
      </ProInfoBlockRefundTitle>
      <Localizer token="proRefundRequestStorePolicies" platform={data.providerConstants.platform} />
      <ProInfoBlockRefundTitle>
        <Localizer token="important" />
      </ProInfoBlockRefundTitle>
      <Localizer token="proImportantDescription" />
    </PanelButtonGroup>
  );
}

function ProInfoBlockRefundIOS() {
  const { data } = useProBackendProStatusLocal();
  return (
    <ProInfoBlockLayout
      titleElement={tr('proRefunding')}
      descriptionElement={
        <Localizer
          token="proPlanPlatformRefund"
          platform_store={data.providerConstants.store}
          platform_account={data.providerConstants.platform_account}
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
                device_type={data.providerConstants.device}
                platform_account={data.providerConstants.platform_account}
              />
            }
          />
          <ProInfoBlockWebsite
            titleType="onThe"
            textElement={
              <Localizer
                token="requestRefundPlatformWebsite"
                platform={data.providerConstants.platform}
                platform_account={data.providerConstants.platform_account}
              />
            }
          />
        </>
      }
    />
  );
}

function ProInfoBlockRefund() {
  const { data } = useProBackendProStatusLocal();

  if (!data.isPlatformRefundAvailable) {
    return <ProInfoBlockRefundSessionSupport />;
  }

  switch (data.provider) {
    case ProPaymentProvider.AppStore:
      return <ProInfoBlockRefundIOS />;
    case ProPaymentProvider.GooglePlay:
      return <ProInfoBlockRefundGooglePlay />;
    default:
      // Rangeproof, none (''), or an unknown/future provider slug -> the Session-support refund flow.
      return <ProInfoBlockRefundSessionSupport />;
  }
}

function ProInfoBlockRefundRequested() {
  const { data } = useProBackendProStatusLocal();
  const dispatch = getAppDispatch();

  return (
    <PanelButtonGroup containerStyle={containerStyle}>
      <ProInfoBlockRefundTitle>
        <Localizer token="nextSteps" />
      </ProInfoBlockRefundTitle>

      <Localizer token="proRefundNextSteps" platform={data.providerConstants.platform} />
      <ProInfoBlockRefundTitle>
        <Localizer token="helpSupport" />
      </ProInfoBlockRefundTitle>
      <ProInfoBlockDescription
        onClick={() =>
          void openProviderUrl(data.provider, u => u.refundStatusUrl, dispatch)
        }
        style={{ cursor: 'pointer' }}
      >
        <Localizer
          token="proRefundSupport"
          platform={data.providerConstants.platform}
          icon={LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON}
        />
      </ProInfoBlockDescription>
    </PanelButtonGroup>
  );
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
    case 'refundRequested':
      return <ProInfoBlockRefundRequested />;
    case 'renew':
      return <ProInfoBlockRenew />;
    default:
      return assertUnreachable(variant, `Unknown pro non originating page variant: ${variant}`);
  }
}

function ProPageButtonUpdate() {
  const dispatch = getAppDispatch();
  const { data } = useProBackendProStatusLocal();
  const storeOrPlatform = useStoreOrPlatformFromProvider(data);

  return (
    <SessionButton
      {...proButtonProps}
      buttonColor={SessionButtonColor.Primary}
      onClick={() => {
        void openProviderUrl(data.provider, u => u.updateSubscriptionUrl, dispatch);
      }}
      dataTestId="pro-open-platform-website-button"
    >
      <Localizer token="openPlatformWebsite" platform={storeOrPlatform} />
    </SessionButton>
  );
}

function ProPageButtonCancel() {
  const dispatch = getAppDispatch();
  const { data } = useProBackendProStatusLocal();
  const storeOrPlatform = useStoreOrPlatformFromProvider(data);
  return (
    <SessionButton
      {...proButtonProps}
      buttonColor={SessionButtonColor.Danger}
      onClick={() => {
        void openProviderUrl(data.provider, u => u.cancelSubscriptionUrl, dispatch);
      }}
      dataTestId="pro-open-platform-website-button"
    >
      <Localizer token="openPlatformWebsite" platform={storeOrPlatform} />
    </SessionButton>
  );
}

function ProPageButtonRefund() {
  const dispatch = getAppDispatch();
  const { data } = useProBackendProStatusLocal();
  const storeOrPlatform = useStoreOrPlatformFromProvider(data);
  return (
    <SessionButton
      {...proButtonProps}
      buttonColor={SessionButtonColor.Danger}
      onClick={() => {
        void openProviderUrl(
          data.provider,
          u => (data.isPlatformRefundAvailable ? u.refundPlatformUrl : u.refundSupportUrl),
          dispatch
        );
      }}
      dataTestId="pro-open-platform-website-button"
    >
      {data.isPlatformRefundAvailable ? (
        <Localizer token="openPlatformWebsite" platform={storeOrPlatform} />
      ) : (
        <Localizer token="requestRefund" />
      )}
    </SessionButton>
  );
}

function ProPageButtonRefundRequested() {
  const dispatch = getAppDispatch();

  return (
    <SessionButton
      {...proButtonProps}
      buttonColor={SessionButtonColor.Primary}
      onClick={() => {
        dispatch(
          userSettingsModal({
            userSettingsPage: 'pro',
          })
        );
      }}
      dataTestId="pro-refund-return-button"
    >
      <Localizer token="theReturn" />
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
    case 'refundRequested':
      return <ProPageButtonRefundRequested />;
    default:
      return assertUnreachable(variant, `Unknown pro non originating page variant: ${variant}`);
  }
}

export function ProNonOriginatingPage(modalState: {
  userSettingsPage: 'proNonOriginating';
  nonOriginatingVariant: ProNonOriginatingPageVariant;
  hideBackButton?: boolean;
  centerAlign?: boolean;
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
        <ProPageHero variant={modalState.nonOriginatingVariant} />
        <ProInfoBlock variant={modalState.nonOriginatingVariant} />
        <ProPageButton variant={modalState.nonOriginatingVariant} />
      </ModalFlexContainer>
    </UserSettingsModalContainer>
  );
}
