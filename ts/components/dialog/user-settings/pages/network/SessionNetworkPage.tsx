import { getAppDispatch } from '../../../../../state/dispatch';
import { ModalBasicHeader } from '../../../../SessionWrapperModal';
import { StakeSection } from './sections/StakeSection';
import { ExtraSmallText, LastRefreshedText } from './components';
import { SpacerMD, SpacerXL, SpacerXS } from '../../../../basic/Text';
import {
  useInfoFakeRefreshing,
  useInfoLoading,
  useLastRefreshedTimestamp,
} from '../../../../../state/selectors/networkModal';
import { NetworkSection } from './sections/network/NetworkSection';
import { useDataIsStale } from '../../../../../state/selectors/networkData';
import { SessionLucideIconButton } from '../../../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../../../icon/lucide';
import { networkDataActions } from '../../../../../state/ducks/networkData';
import {
  useUserSettingsBackAction,
  useUserSettingsCloseAction,
  useUserSettingsTitle,
} from '../userSettingsHooks';
import type { UserSettingsModalState } from '../../../../../state/ducks/modalDialog';
import { ModalBackButton } from '../../../shared/ModalBackButton';
import { UserSettingsModalContainer } from '../../components/UserSettingsModalContainer';
import { focusVisibleOutlineStr } from '../../../../../styles/focusVisible';

function ReloadButton({ loading }: { loading: boolean }) {
  const dispatch = getAppDispatch();

  return (
    <SessionLucideIconButton
      iconSize="medium"
      unicode={LUCIDE_ICONS_UNICODE.REFRESH_CW}
      dataTestId="refresh-button"
      iconColor="var(--text-primary-color)"
      disabled={loading}
      focusVisibleEffect={focusVisibleOutlineStr('var(--margins-xs)')}
      onClick={() => {
        if (loading) {
          return;
        }
        dispatch(networkDataActions.refreshInfoFromSeshServer() as any);
      }}
    />
  );
}

export function SessionNetworkPage(modalState: UserSettingsModalState) {
  const infoLoading = useInfoLoading();
  const isFakeRefreshing = useInfoFakeRefreshing();
  const dataIsStale = useDataIsStale();

  const lastRefreshedTimestamp = useLastRefreshedTimestamp();

  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);
  const title = useUserSettingsTitle(modalState);

  const loading = infoLoading || isFakeRefreshing;

  return (
    <UserSettingsModalContainer
      headerChildren={
        <ModalBasicHeader
          title={title}
          bigHeader={true}
          showExitIcon={true}
          extraLeftButton={backAction ? <ModalBackButton onClick={backAction} /> : undefined}
          extraRightButton={<ReloadButton loading={loading} />}
        />
      }
      onClose={closeAction || undefined}
    >
      <NetworkSection />
      <StakeSection />
      {!dataIsStale && lastRefreshedTimestamp && !loading ? (
        <>
          <SpacerXL />
          <ExtraSmallText color={'var(--text-secondary-color)'} $textAlignment="center">
            <LastRefreshedText />
          </ExtraSmallText>
          <SpacerXS />
        </>
      ) : (
        <SpacerMD />
      )}
    </UserSettingsModalContainer>
  );
}
