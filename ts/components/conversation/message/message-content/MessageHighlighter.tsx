import { motion } from 'framer-motion';
import { MouseEvent, ReactNode } from 'react';
import styled from 'styled-components';
import { THEME_GLOBALS } from '../../../../themes/globals';

const StyledMessageHighlighter = styled(motion.div)``;

export function MessageHighlighter(props: {
  children: ReactNode;
  $highlight: boolean;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  const { children, $highlight, onClick } = props;

  return (
    <StyledMessageHighlighter
      onClick={onClick}
      animate={{
        opacity: $highlight ? [1, 0.2, 1, 0.2, 1] : undefined,
        transition: {
          duration: THEME_GLOBALS['--duration-message-highlight-seconds'],
          ease: 'linear',
          repeat: 0,
        },
      }}
    >
      {children}
    </StyledMessageHighlighter>
  );
}
