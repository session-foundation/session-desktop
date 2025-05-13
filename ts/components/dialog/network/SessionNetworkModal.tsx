import { useDispatch } from 'react-redux';
import { AnimatePresence } from 'framer-motion';
import { updateSessionNetworkModal } from '../../../state/ducks/modalDialog';
import { SessionWrapperModal2 } from '../../SessionWrapperModal2';
import { LOCALE_DEFAULTS } from '../../../localization/constants';
import { showSettingsSection } from '../../../state/ducks/section';
import { StakeSection } from './sections/StakeSection';
import { ExtraSmallText, LastRefreshedText } from './components';
import { SpacerMD, SpacerXL, SpacerXS } from '../../basic/Text';
import {
  useInfoLoading,
  useLastRefreshedTimestamp,
  useNodesLoading,
} from '../../../state/selectors/networkModal';
import { NetworkSection } from './sections/network/NetworkSection';
import { networkDataActions } from '../../../state/ducks/networkData';
import { useIsOnline } from '../../../state/selectors/onions';

export function SessionNetworkModal() {
  const isOnline = useIsOnline();

  const infoLoading = useInfoLoading();
  const nodesLoading = useNodesLoading();

  const lastRefreshedTimestamp = useLastRefreshedTimestamp();

  const dispatch = useDispatch();
  const onClose = () => {
    dispatch(showSettingsSection('privacy'));
    dispatch(updateSessionNetworkModal(null));
  };

  return (
    <AnimatePresence>
      <SessionWrapperModal2
        title={LOCALE_DEFAULTS.network_name}
        onClose={onClose}
        contentBorder={false}
        shouldOverflow={true}
        showExitIcon={true}
        headerIconButtons={[
          {
            rotateDuration: infoLoading ? 1.5 : undefined,
            iconType: 'resend',
            onClick: () => {
              if (infoLoading) {
                return;
              }
              dispatch(
                networkDataActions.refreshInfoFromSeshServer({ forceRefresh: !isOnline }) as any
              );
            },
            dataTestIdIcon: 'refresh-button',
            disabled: infoLoading,
          },
        ]}
        bigHeader={true}
      >
        <NetworkSection loading={infoLoading} />
        <StakeSection loading={infoLoading} />
        {lastRefreshedTimestamp && !infoLoading && !nodesLoading ? (
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
