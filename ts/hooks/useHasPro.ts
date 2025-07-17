import { useFeatureFlag } from '../state/ducks/types/releasedFeaturesReduxTypes';
import { useIsProAvailable } from './useIsProAvailable';

export function useHasPro() {
  const isProAvailable = useIsProAvailable();
  const mockHasPro = useFeatureFlag('mockUserHasPro');

  // TODO: get pro status from store once available
  const hasPro = mockHasPro;

  return isProAvailable && hasPro;
}
