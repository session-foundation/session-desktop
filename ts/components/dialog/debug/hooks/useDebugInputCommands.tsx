import { type Dispatch, useEffect } from 'react';
import { isDevProd } from '../../../../shared/env_vars';
import LIBSESSION_CONSTANTS from '../../../../session/utils/libsession/libsession_constants';
import { getFeatureFlagMemo } from '../../../../state/ducks/types/releasedFeaturesReduxTypes';

type DebugInputCommandsArgs = {
  value: string;
  setValue: Dispatch<string>;
};

const isDev = isDevProd();
const maxMessageStandard = Array.from({
  length: LIBSESSION_CONSTANTS.MESSAGE_CHARACTER_LIMIT_STANDARD,
})
  .fill('a')
  .join('');

const maxMessagePro = Array.from({ length: LIBSESSION_CONSTANTS.MESSAGE_CHARACTER_LIMIT_PRO })
  .fill('a')
  .join('');

export function useDebugInputCommands({ value, setValue }: DebugInputCommandsArgs) {
  if (!isDev) {
    return null;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks -- Conditional doesn't change at runtime
  const debugInputCommands = getFeatureFlagMemo('debugInputCommands');

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!debugInputCommands) {
      return;
    }

    switch (value) {
      case 'fill()':
        setValue(maxMessageStandard);
        break;

      case 'fillPro()':
        setValue(maxMessagePro);
        break;

      default:
        break;
    }
  }, [debugInputCommands, setValue, value]);

  return null;
}
