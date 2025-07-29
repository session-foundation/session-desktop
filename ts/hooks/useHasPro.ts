import { useIsProAvailable } from './useIsProAvailable';
import { useWeAreProUser } from './useParamSelector';

export function useCurrentUserHasPro() {
  const isProAvailable = useIsProAvailable();
  const weArePro = useWeAreProUser();

  return isProAvailable && weArePro;
}
