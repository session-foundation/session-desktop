import { UserUtils } from '../session/utils';
import { useIsProAvailable } from './useIsProAvailable';
import { useIsProUser } from './useParamSelector';

export function useCurrentUserHasPro() {
  const isProAvailable = useIsProAvailable();
  const weArePro = useIsProUser(UserUtils.getOurPubKeyStrFromCache());

  return isProAvailable && weArePro;
}

export function useUserHasPro(convoId?: string) {
  const isProAvailable = useIsProAvailable();
  const userIsPro = useIsProUser(convoId);

  return isProAvailable && userIsPro;
}
