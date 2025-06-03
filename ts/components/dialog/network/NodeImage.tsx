import { type SVGProps, type JSX } from 'react';
import styled from 'styled-components';
import { Block } from './components';
import { SessionSpinner } from '../../loading';
import { StyledSessionSpinner } from '../../loading/spinner/StyledSessionSpinner';
import { NodeGraph1 } from './nodes/NodeGraph1';
import { NodeGraph10 } from './nodes/NodeGraph10';
import { NodeGraph2 } from './nodes/NodeGraph2';
import { NodeGraph3 } from './nodes/NodeGraph3';
import { NodeGraph4 } from './nodes/NodeGraph4';
import { NodeGraph5 } from './nodes/NodeGraph5';
import { NodeGraph6 } from './nodes/NodeGraph6';
import { NodeGraph7 } from './nodes/NodeGraph7';
import { NodeGraph8 } from './nodes/NodeGraph8';
import { NodeGraph9 } from './nodes/NodeGraph9';
import { useSecuringNodesCount } from './sections/network/hooks/useSecuringNodesCount';

const StyledNodeImage = styled(Block)`
  display: flex;
  justify-content: center;
  align-items: center;

  ${StyledSessionSpinner} {
    margin: auto;
  }

  svg,
  ${StyledSessionSpinner} {
    position: absolute;
    inset: 0;
  }

  svg:nth-child(2) {
    transform: translateY((-100%));
  }
`;

export type NodeGraphProps = SVGProps<SVGSVGElement> & { nodeColor: string; pathColor: string };

type Props = {
  count: number;
  width: string;
  height: string;
  loading?: boolean;
};

const nodeComps: Record<number, (props: NodeGraphProps) => JSX.Element> = {
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

export const NodeImage = ({ width, height, loading }: Props) => {
  const { swarmNodeCount } = useSecuringNodesCount();

  const NodeComp = nodeComps[swarmNodeCount ?? 0];
  const sharedNodeProps = {
    nodeColor: 'var(--primary-color)',
    pathColor: 'var(--text-primary-color)',
    width,
    height,
  };

  const ready = !loading && NodeComp;

  return (
    <StyledNodeImage
      $flexDirection="column"
      $justifyContent="center"
      $alignItems="center"
      borderColor="var(--primary-color)"
      width={width}
      height={height}
      style={{ position: 'relative', overflow: 'hidden' }}
      data-testid="swarm-image"
    >
      {ready ? (
        <NodeComp {...sharedNodeProps} />
      ) : (
        <SessionSpinner loading={true} width="96px" height={'96px'} />
      )}
    </StyledNodeImage>
  );
};
