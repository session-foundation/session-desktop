import useInterval from 'react-use/lib/useInterval';
import { useDispatch } from 'react-redux';
import { DURATION } from '../session/constants';
import { updateReleasedFeatures } from '../state/ducks/releasedFeatures';
import { NetworkTime } from '../util/NetworkTime';

export function useRefreshReleasedFeaturesTimestamp() {
  const dispatch = useDispatch();

  useInterval(() => {
    const nowFromNetwork = NetworkTime.now();
    dispatch(updateReleasedFeatures(nowFromNetwork));
  }, 1 * DURATION.SECONDS);
}
