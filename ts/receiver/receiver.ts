/* eslint-disable more/no-then */

// innerHandleSwarmContentMessage is only needed because of code duplication in handleDecryptedEnvelope...
import { innerHandleSwarmContentMessage } from './contentMessage';

import { DURATION } from '../session/constants';
import { sleepFor } from '../session/utils/Promise';
import type { SwarmDecodedEnvelope } from './types';

export async function handleSwarmContentDecryptedWithTimeout({
  decodedEnvelope,
}: {
  decodedEnvelope: SwarmDecodedEnvelope;
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
        decodedEnvelope.id
      );
    })(),
    (async () => {
      try {
        await innerHandleSwarmContentMessage({
          decodedEnvelope,
        });
      } catch (e) {
        window.log.error(
          'handleSwarmContentDecryptedWithTimeout task failed with ',
          e.message,
          decodedEnvelope.id
        );
      } finally {
        taskDone = true;
      }
    })(),
  ]);
}
