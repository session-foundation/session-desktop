import { SessionDataTestId } from 'react';
import styled from 'styled-components';
import { Flex } from './basic/Flex';
import type { LUCIDE_ICONS_UNICODE } from './icon/lucide';

const StyledNoticeBanner = styled(Flex)<{ isClickable: boolean }>`
  background-color: var(--primary-color);
  color: var(--black-color);
  font-size: var(--font-size-md);
  padding: var(--margins-xs) var(--margins-sm);
  text-align: center;
  flex-shrink: 0;
  cursor: ${props => (props.isClickable ? 'pointer' : 'default')};

  .session-icon-button {
    right: var(--margins-sm);
    pointer-events: none;
  }
`;

const StyledBannerText = styled.div`
  margin-right: var(--margins-sm);
  font-family: var(--font-default), var(--font-icon);
`;

type NoticeBannerProps = {
  text: string;
  onBannerClick?: () => void;
  dataTestId: SessionDataTestId;
  unicode?: LUCIDE_ICONS_UNICODE;
};

const StyledIconContainer = styled.span`
  vertical-align: middle;
  margin-inline-start: var(--margins-xs);
`;

export const NoticeBanner = (props: NoticeBannerProps) => {
  const { text, onBannerClick, dataTestId } = props;

  return (
    <StyledNoticeBanner
      $container={true}
      $flexDirection={'row'}
      $justifyContent={'center'}
      $alignItems={'center'}
      data-testid={dataTestId}
      isClickable={!!onBannerClick}
      onClick={event => {
        if (!onBannerClick) {
          return;
        }
        event?.preventDefault();
        onBannerClick();
      }}
    >
      <StyledBannerText>
        {text}
        {props.unicode ? <StyledIconContainer>{props.unicode}</StyledIconContainer> : null}
      </StyledBannerText>
    </StyledNoticeBanner>
  );
};
