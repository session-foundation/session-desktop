import useInterval from 'react-use/lib/useInterval';
import { getAppDispatch } from '../state/dispatch';
import { releasedFeaturesActions } from '../state/ducks/releasedFeatures';
import { NetworkTime } from '../util/NetworkTime';
import { FEATURE_RELEASE_CHECK_INTERVAL } from '../state/ducks/types/releasedFeaturesReduxTypes';

// NOTE: this is not used anywhere yet, but we may want it it in the future
export function useCheckReleasedFeatures() {
  const dispatch = getAppDispatch();

  useInterval(() => {
    const nowFromNetwork = NetworkTime.now();
    dispatch(
      releasedFeaturesActions.updateReleasedFeatures({
        refreshedAt: nowFromNetwork,
      })
    );
  }, FEATURE_RELEASE_CHECK_INTERVAL);
}
