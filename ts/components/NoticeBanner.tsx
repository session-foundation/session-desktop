import { SessionDataTestId } from 'react';
import styled from 'styled-components';
import { Flex } from './basic/Flex';
import { LUCIDE_ICONS_UNICODE } from './icon/lucide';
import { SessionLucideIconButton } from './icon/SessionIconButton';
import { tr } from '../localization';

const StyledNoticeBanner = styled(Flex)<{ isClickable: boolean }>`
  background-color: var(--primary-color);
  color: var(--black-color);
  font-size: var(--font-size-md);
  padding: var(--margins-xs) var(--margins-sm);
  text-align: center;
  flex-shrink: 0;
  position: relative;
  cursor: ${props => (props.isClickable ? 'pointer' : 'default')};

  .session-icon-button {
    right: var(--margins-sm);
    pointer-events: none;
  }
`;

const StyledBannerText = styled.div`
  margin-right: var(--margins-sm);
  font-family: var(--font-default);
`;

type NoticeBannerProps = {
  text: string;
  onBannerClick?: () => void;
  dataTestId: SessionDataTestId;
  unicode?: LUCIDE_ICONS_UNICODE;
  onDismiss?: () => void;
  dismissDataTestId?: SessionDataTestId;
};

const StyledDismissContainer = styled.div`
  position: absolute;
  inset-inline-end: var(--margins-sm);
  top: 50%;
  transform: translateY(-50%);
`;

const StyledIconContainer = styled.span`
  font-family: var(--font-icon);
  vertical-align: bottom;
  margin-inline-start: var(--margins-xs);
`;

export const NoticeBanner = (props: NoticeBannerProps) => {
  const { text, onBannerClick, dataTestId, onDismiss, dismissDataTestId } = props;

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
      <StyledBannerText style={onDismiss ? { paddingInline: 'var(--margins-lg)' } : undefined}>
        {text}
        {props.unicode ? <StyledIconContainer>{props.unicode}</StyledIconContainer> : null}
      </StyledBannerText>
      {onDismiss ? (
        <StyledDismissContainer>
          <SessionLucideIconButton
            unicode={LUCIDE_ICONS_UNICODE.X}
            iconSize="small"
            iconColor="var(--black-color)"
            ariaLabel={tr('close')}
            dataTestId={dismissDataTestId}
            onClick={onDismiss}
          />
        </StyledDismissContainer>
      ) : null}
    </StyledNoticeBanner>
  );
};
