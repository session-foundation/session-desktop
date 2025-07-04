import { useDispatch } from 'react-redux';
import { AnimatePresence } from 'framer-motion';
import { updateSessionNetworkModal } from '../../../state/ducks/modalDialog';
import { SessionWrapperModal2 } from '../../SessionWrapperModal2';
import { LOCALE_DEFAULTS } from '../../../localization/constants';
import { sectionActions } from '../../../state/ducks/section';
import { StakeSection } from './sections/StakeSection';
import { ExtraSmallText, LastRefreshedText } from './components';
import { SpacerMD, SpacerXL, SpacerXS } from '../../basic/Text';
import {
  useInfoFakeRefreshing,
  useInfoLoading,
  useLastRefreshedTimestamp,
} from '../../../state/selectors/networkModal';
import { NetworkSection } from './sections/network/NetworkSection';
import { useDataIsStale } from '../../../state/selectors/networkData';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { networkDataActions } from '../../../state/ducks/networkData';

function ReloadButton({ loading }: { loading: boolean }) {
  const dispatch = useDispatch();

  return (
    <SessionLucideIconButton
      iconSize="medium"
      unicode={LUCIDE_ICONS_UNICODE.REFRESH_CW}
      dataTestId="refresh-button"
      disabled={loading}
      onClick={() => {
        if (loading) {
          return;
        }
        dispatch(networkDataActions.refreshInfoFromSeshServer() as any);
      }}
    />
  );
}

export function SessionNetworkModal() {
  const infoLoading = useInfoLoading();
  const isFakeRefreshing = useInfoFakeRefreshing();
  const dataIsStale = useDataIsStale();

  const lastRefreshedTimestamp = useLastRefreshedTimestamp();

  const dispatch = useDispatch();
  const onClose = () => {
    dispatch(sectionActions.showSettingsSection('privacy'));
    dispatch(updateSessionNetworkModal(null));
  };

  const loading = infoLoading || isFakeRefreshing;

  return (
    <AnimatePresence>
      <SessionWrapperModal2
        title={LOCALE_DEFAULTS.network_name}
        bigHeader={true}
        onClose={onClose}
        contentBorder={false}
        shouldOverflow={true}
        showExitIcon={true}
        headerIconButtons={[<ReloadButton loading={loading} />]}
      >
        <NetworkSection />
        <StakeSection />
        {!dataIsStale && lastRefreshedTimestamp && !loading ? (
          <>
            <SpacerXL />
            <ExtraSmallText color={'var(--text-secondary-color)'} textAlignment="center">
              <LastRefreshedText />
            </ExtraSmallText>
            <SpacerXS />
          </>
        ) : (
          <SpacerMD />
        )}
      </SessionWrapperModal2>
    </AnimatePresence>
  );
}
