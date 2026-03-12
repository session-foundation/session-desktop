import { motion } from 'framer-motion';
import type { MouseEvent, KeyboardEvent, ReactNode } from 'react';
import styled from 'styled-components';
import { THEME_GLOBALS } from '../../../../themes/globals';

const StyledMessageHighlighter = styled(motion.div)``;

export function MessageHighlighter(props: {
  children: ReactNode;
  $highlight: boolean;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  tabIndex?: number;
}) {
  const { children, $highlight, onClick, onKeyDown, tabIndex } = props;

  return (
    <StyledMessageHighlighter
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
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
