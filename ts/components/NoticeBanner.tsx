import { SessionDataTestId } from 'react';
import styled from 'styled-components';
import { Flex } from './basic/Flex';
import { SessionIconButton, SessionIconType } from './icon';
import { StyledRootDialog } from './dialog/StyledRootDialog';

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

const StyledText = styled.span`
  margin-right: var(--margins-sm);
`;

type NoticeBannerProps = {
  text: string;
  icon?: SessionIconType;
  onBannerClick?: () => void;
  dataTestId: SessionDataTestId;
};

export const NoticeBanner = (props: NoticeBannerProps) => {
  const { text, onBannerClick, icon, dataTestId } = props;

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
      <StyledText>{text}</StyledText>
      {icon ? <SessionIconButton iconType={icon} iconColor="inherit" iconSize="small" /> : null}
    </StyledNoticeBanner>
  );
};

const StyledGroupInviteBanner = styled(Flex)`
  position: relative;
  color: var(--black-color);
  background-color: var(--orange-color);
  font-size: var(--font-size-sm);
  padding: var(--margins-xs) var(--margins-lg);
  text-align: center;
  flex-shrink: 0;

  // when part a a dialog, invert it and make it narrower (as the dialog grows to make it fit)
  ${StyledRootDialog} & {
    max-width: 300px;
    color: var(--warning-color);
    background-color: inherit;
  }
`;

export const GroupInviteRequiredVersionBanner = () => {
  return (
    <StyledGroupInviteBanner data-testid="version-warning">
      {window.i18n('groupInviteVersion')}
    </StyledGroupInviteBanner>
  );
};
