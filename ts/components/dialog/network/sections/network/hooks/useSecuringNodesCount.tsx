import { useDispatch, useSelector } from 'react-redux';
import useAsyncRetry from 'react-use/lib/useAsyncRetry';
import { useEffect } from 'react';
import { onionPaths } from '../../../../../../session/onions/onionPath';
import {
  getLeftPaneConversationIdsCount,
  getGroupConversationsCount,
} from '../../../../../../state/selectors/conversations';
import { SnodePool } from '../../../../../../session/apis/snode_api/snodePool';
import { useNetworkSize } from '../../../../../../state/selectors/networkData';
import { useIsOnline } from '../../../../../../state/selectors/onions';
import { useNodesLoading } from '../../../../../../state/selectors/networkModal';
import { setNodesLoading } from '../../../../../../state/ducks/networkModal';

export function useSecuringNodesCount() {
  const privateCounversationsCount = useSelector(getLeftPaneConversationIdsCount);
  const groupConversationsCount = useSelector(getGroupConversationsCount);
  const networkSize = useNetworkSize();
  const isOnline = useIsOnline();
  const dispatch = useDispatch();
  const nodesLoading = useNodesLoading();

  if (!networkSize) {
    window.log.error('[useSecuringNodesCount] networkSize is not defined');
  }

  const nodeCountState = useAsyncRetry(async () => {
    dispatch(setNodesLoading(true));
    return SnodePool.getSwarmNodeCount();
  });

  if (nodeCountState.error) {
    window.log.error(`[useSecuringNodesCount] nodeCountState error: ${nodeCountState.error}`);
  }

  // NOTE: Groups count includes legacy groups
  const estimatedValue =
    nodeCountState.loading || nodeCountState.error || !nodeCountState.value
      ? undefined
      : nodeCountState.value +
        onionPaths.length * 3 +
        (privateCounversationsCount * 6 + groupConversationsCount * 6);

  const securingNodesCount =
    estimatedValue && networkSize ? Math.min(networkSize, estimatedValue) : undefined;

  const swarmNodeCount = nodeCountState.value;

  useEffect(() => {
    if (
      isOnline &&
      !nodeCountState.loading &&
      !nodeCountState.error &&
      !securingNodesCount &&
      !swarmNodeCount
    ) {
      nodeCountState.retry();
    }
  }, [isOnline, nodeCountState, securingNodesCount, swarmNodeCount]);

  useEffect(() => {
    if (isOnline && nodesLoading && securingNodesCount && swarmNodeCount) {
      dispatch(setNodesLoading(false));
    }
  }, [dispatch, isOnline, nodesLoading, securingNodesCount, swarmNodeCount]);

  return {
    securingNodesCount,
    swarmNodeCount,
    error: nodeCountState.error,
    loading: nodeCountState.loading,
  };
}
