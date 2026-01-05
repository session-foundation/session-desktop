import styled from 'styled-components';
import { Block } from './components';
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

const StyledNodeImage = styled(Block)<{ $nodeColor: string; $pathColor: string }>`
  display: flex;
  justify-content: center;
  align-items: center;
  --c1: ${({ $nodeColor }) => $nodeColor};
  --c2: ${({ $pathColor }) => $pathColor};

  ${AnimatedSpinnerIconWrapper} {
    margin: auto;
  }

  svg,
  ${AnimatedSpinnerIconWrapper} {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
`;

type Props = {
  width: string;
  height: string;
};

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

export const NodeImage = ({ width, height }: Props) => {
  const { swarmNodeCount, dataIsStale } = useSecuringNodesCount();
  const isFakeRefreshing = useInfoFakeRefreshing();
  const NodeGraph = nodeGraphs[swarmNodeCount ?? 1];

  const loading = !swarmNodeCount || !NodeGraph || dataIsStale || isFakeRefreshing;

  return (
    <StyledNodeImage
      $flexDirection="column"
      $justifyContent="center"
      $alignItems="center"
      $nodeColor="var(--primary-color)"
      $pathColor="var(--text-primary-color)"
      $borderColor={!loading ? 'hidden' : undefined}
      width={width}
      height={height}
      style={{ position: 'relative', overflow: 'hidden' }}
      data-testid="swarm-image"
    >
      {!loading ? <NodeGraph /> : <AnimatedSpinnerIcon size="huge2" />}
    </StyledNodeImage>
  );
};
