import styled from 'styled-components';
import type { ReactNode } from 'react';
import type { WithOptLucideUnicode } from '../../../../icon/lucide';
import { LucideIcon } from '../../../../icon/LucideIcon';

const NotificationBubbleFlex = styled.div`
  display: flex;
  background: var(--message-bubbles-received-background-color);
  color: var(--text-primary-color);
  width: 90%;
  max-width: 700px;
  margin: 5px auto 10px auto; // top margin is smaller that bottom one to make the stopwatch icon of expirable message closer to its content
  padding: 5px 10px;
  border-radius: 16px;
  word-break: break-word;
  text-align: center;
  align-items: center;
`;

const NotificationBubbleText = styled.div`
  color: inherit;
  margin: auto auto;
`;

const NotificationBubbleIconContainer = styled.div`
  margin: auto 10px;
  align-content: center;
  width: 15px;
  height: 25px;
`;

export const NotificationBubble = (
  props: WithOptLucideUnicode & {
    iconColor?: string;
    children: ReactNode;
  }
) => {
  const { children, unicode, iconColor } = props;
  return (
    <NotificationBubbleFlex>
      {unicode && (
        <NotificationBubbleIconContainer>
          <LucideIcon
            iconSize="small"
            unicode={unicode}
            iconColor={iconColor}
            style={{ padding: 'auto 10px' }}
          />
        </NotificationBubbleIconContainer>
      )}
      <NotificationBubbleText>{children}</NotificationBubbleText>
      {unicode && <NotificationBubbleIconContainer />}
    </NotificationBubbleFlex>
  );
};
