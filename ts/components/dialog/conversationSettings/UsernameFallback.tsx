import styled from 'styled-components';
import type { WithConvoId } from '../../../session/types/with';
import { useConversationRealName, useHasNickname } from '../../../hooks/useParamSelector';

const StyledNameFallback = styled.div`
  color: var(--text-secondary-color);
  text-align: center;
  font-weight: 400;
  line-height: 1.2;
  font-size: var(--font-display-size-md);
`;

export function UsernameFallback({ conversationId }: WithConvoId) {
  const hasNickname = useHasNickname(conversationId);
  const conversationRealName = useConversationRealName(conversationId);

  return hasNickname && conversationRealName ? (
    <StyledNameFallback data-testid="fallback-display-name">
      ({conversationRealName})
    </StyledNameFallback>
  ) : null;
}
