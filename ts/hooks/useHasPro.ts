import { useIsProAvailable } from './useIsProAvailable';
import { useWeAreProUser } from './useParamSelector';

export function useCurrentUserHasPro() {
  const isProAvailable = useIsProAvailable();
  const weArePro = useWeAreProUser(); // this will be true when `mockUserHasPro` is true

  return isProAvailable && weArePro;
}
