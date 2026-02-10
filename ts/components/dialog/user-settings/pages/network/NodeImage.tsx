import styled from 'styled-components';
import { useSecuringNodesCount } from './sections/network/hooks/useSecuringNodesCount';
import {
  AnimatedSpinnerIcon,
  AnimatedSpinnerIconWrapper,
} from '../../../../loading/spinner/AnimatedSpinnerIcon';
import {
  NodeGraph1,
  NodeGraph10,
  NodeGraph2,
  NodeGraph3,
  NodeGraph4,
  NodeGraph5,
  NodeGraph6,
  NodeGraph7,
  NodeGraph8,
  NodeGraph9,
} from '../../../../../svgs/index';
import { useInfoFakeRefreshing } from '../../../../../state/selectors/networkModal';
import { clamp } from 'lodash';

const StyledNodeImage = styled.div<{ $nodeColor: string; $pathColor: string }>`
  --c1: ${({ $nodeColor }) => $nodeColor};
  --c2: ${({ $pathColor }) => $pathColor};

  ${AnimatedSpinnerIconWrapper} {
    margin: auto;
  }
`;

const StyledLoaderContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  border: 1px solid var(--primary-color);
  border-radius: 8px;
`;

const nodeGraphs: Record<number, React.FC<React.SVGProps<SVGSVGElement>>> = {
  1: NodeGraph1,
  2: NodeGraph2,
  3: NodeGraph3,
  4: NodeGraph4,
  5: NodeGraph5,
  6: NodeGraph6,
  7: NodeGraph7,
  8: NodeGraph8,
  9: NodeGraph9,
  10: NodeGraph10,
};

export const NodeImage = () => {
  const { swarmNodeCount, dataIsStale } = useSecuringNodesCount();
  const isFakeRefreshing = useInfoFakeRefreshing();
  // Note: clamp so that we always have a swarm image even if we have too many nodes in our swarm.
  // On sesh-net for instance we can have 11 or more
  const NodeGraph = nodeGraphs[clamp(swarmNodeCount ?? 1, 1, 10)];

  const loading = !swarmNodeCount || !NodeGraph || dataIsStale || isFakeRefreshing;

  return (
    <StyledNodeImage
      $nodeColor="var(--primary-color)"
      $pathColor="var(--text-primary-color)"
      data-testid="swarm-image"
    >
      {!loading ? (
        <NodeGraph />
      ) : (
        <StyledLoaderContainer>
          <AnimatedSpinnerIcon size="huge2" />
        </StyledLoaderContainer>
      )}
    </StyledNodeImage>
  );
};
