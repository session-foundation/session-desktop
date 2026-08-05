import { ConfigMessageHandler } from '../../../../receiver/configMessage';
import { RetrieveMessageItemWithNamespace } from '../types';

/**
 * @returns whether everything fetched was actually taken in. The swallowing below is deliberate —
 * one bad config message must not fail a whole poll — but that makes a merge failure a log line
 * rather than a value or an exception, so a caller cannot otherwise tell success from silence.
 * Anything relying on "our local state is level with the swarm" has to read this, not the fetch.
 */
async function handleUserSharedConfigMessages(
  userConfigMessagesMerged: Array<RetrieveMessageItemWithNamespace>
): Promise<boolean> {
  try {
    if (userConfigMessagesMerged.length) {
      window.log.info(
        `received userConfigMessagesMerged count: ${userConfigMessagesMerged.length}`
      );

      try {
        window.log.info(
          `handleConfigMessagesViaLibSession of "${userConfigMessagesMerged.length}" messages with libsession`
        );
        // not just "did it throw" — a merge that took in only some of what it was given reports
        // false here, and that is not something an exception would have told us.
        return await ConfigMessageHandler.handleUserConfigMessagesViaLibSession(
          userConfigMessagesMerged
        );
      } catch (e) {
        const allMessageHashes = userConfigMessagesMerged.map(m => m.hash).join(',');
        window.log.warn(
          `failed to handle messages hashes "${allMessageHashes}" with libsession. Error: "${e.message}"`
        );
        return false;
      }
    }
    return true;
  } catch (e) {
    window.log.warn(
      `handleSharedConfigMessages of ${userConfigMessagesMerged.length} failed with ${e.message}`
    );
    // not rethrowing
    return false;
  }
}

export const SwarmPollingUserConfig = { handleUserSharedConfigMessages };
