import { type Dispatch, useEffect } from 'react';
import { isDevProd } from '../../../../shared/env_vars';
import { Constants } from '../../../../session';
import { getFeatureFlag } from '../../../../state/ducks/types/releasedFeaturesReduxTypes';

type DebugInputCommandsArgs = {
  value: string;
  setValue: Dispatch<string>;
};

const isDev = isDevProd();
const maxMessageStandard = Array.from({
  length: Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_STANDARD,
})
  .fill('a')
  .join('');

const maxMessagePro = Array.from({ length: Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_PRO })
  .fill('a')
  .join('');

export function useDebugInputCommands({ value, setValue }: DebugInputCommandsArgs) {
  if (!isDev) {
    return null;
  }

  const debugInputCommands = getFeatureFlag('debugInputCommands');

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
