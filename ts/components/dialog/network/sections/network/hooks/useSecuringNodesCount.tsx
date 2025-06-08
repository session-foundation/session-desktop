import { useSelector } from 'react-redux';
import { isNil } from 'lodash';
import { onionPaths } from '../../../../../../session/onions/onionPath';
import {
  getLeftPaneConversationIdsCount,
  getGroupConversationsCount,
} from '../../../../../../state/selectors/conversations';
import { useDataIsStale, useNetworkSize } from '../../../../../../state/selectors/networkData';
import { UserUtils } from '../../../../../../session/utils';
import { SnodePool } from '../../../../../../session/apis/snode_api/snodePool';

export function useSecuringNodesCount() {
  const privateConversationsCount = useSelector(getLeftPaneConversationIdsCount);
  const groupConversationsCount = useSelector(getGroupConversationsCount);
  const networkSize = useNetworkSize();
  const dataIsStale = useDataIsStale();

  if (!networkSize) {
    window.log.debug('[useSecuringNodesCount] networkSize is not defined');
  }

  const ourSwarmNodeCount = SnodePool.getCachedSwarmSizeForPubkey(
    UserUtils.getOurPubKeyStrFromCache()
  );

  // NOTE: Groups count includes legacy groups
  const estimatedValue = isNil(ourSwarmNodeCount)
    ? undefined
    : ourSwarmNodeCount +
      onionPaths.length * 3 +
      (privateConversationsCount * 6 + groupConversationsCount * 6);

  const securingNodesCount =
    estimatedValue && networkSize ? Math.min(networkSize, estimatedValue) : undefined;

  return {
    securingNodesCount,
    swarmNodeCount: ourSwarmNodeCount,
    dataIsStale,
  };
}
