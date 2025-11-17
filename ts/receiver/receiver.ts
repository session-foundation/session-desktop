/* eslint-disable more/no-then */

// innerHandleSwarmContentMessage is only needed because of code duplication in handleDecryptedEnvelope...
import { innerHandleSwarmContentMessage } from './contentMessage';

import { DURATION } from '../session/constants';
import { sleepFor } from '../session/utils/Promise';
import type { DecodedEnvelope } from './types';

export async function handleSwarmContentDecryptedWithTimeout({
  envelope,
}: {
  envelope: DecodedEnvelope;
}) {
  let taskDone = false;
  return Promise.race([
    (async () => {
      await sleepFor(1 * DURATION.MINUTES); // 1 minute expiry per message seems more than enough
      if (taskDone) {
        return;
      }
      window.log.error(
        'handleSwarmContentDecryptedWithTimeout timer expired for envelope ',
        envelope.id
      );
    })(),
    (async () => {
      try {
        await innerHandleSwarmContentMessage({
          envelope,
        });
      } catch (e) {
        window.log.error(
          'handleSwarmContentDecryptedWithTimeout task failed with ',
          e.message,
          envelope.id
        );
      } finally {
        taskDone = true;
      }
    })(),
  ]);
}
