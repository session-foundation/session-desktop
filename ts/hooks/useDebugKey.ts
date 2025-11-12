import useKey from 'react-use/lib/useKey';
import { isDevProd } from '../shared/env_vars';

export type UseDebugKeyArgs = {
  key: KeyboardEvent['key'];
  withCtrl?: boolean;
  callback: () => void;
};

export function useDebugKey({ callback, key, withCtrl }: UseDebugKeyArgs) {
  if (!isDevProd()) {
    return;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- isDevProd is static during runtime, we can conditionally mount this hook.
  useKey((event: KeyboardEvent) => {
    if (withCtrl && !(event.ctrlKey || event.metaKey)) {
      return false;
    }
    return event.key === key;
  }, callback);
}
