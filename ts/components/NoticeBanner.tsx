import { SessionDataTestId } from 'react';
import styled from 'styled-components';
import { Flex } from './basic/Flex';
import { SessionIconButton, SessionIconType } from './icon';
import { StyledRootDialog } from './dialog/StyledRootDialog';

const StyledNoticeBanner = styled(Flex)`
  position: relative;
  background-color: var(--primary-color);
  color: var(--black-color);
  font-size: var(--font-size-md);
  padding: var(--margins-xs) var(--margins-sm);
  text-align: center;
  flex-shrink: 0;
  cursor: pointer;

  .session-icon-button {
    position: absolute;
    right: var(--margins-sm);
    pointer-events: none;
  }
`;

const StyledText = styled.span`
  margin-right: var(--margins-xl);
`;

type NoticeBannerProps = {
  text: string;
  icon: SessionIconType;
  onBannerClick: () => void;
  dataTestId: SessionDataTestId;
};

export const NoticeBanner = (props: NoticeBannerProps) => {
  const { text, onBannerClick, icon, dataTestId } = props;

  return (
    <StyledNoticeBanner
      container={true}
      flexDirection={'row'}
      justifyContent={'center'}
      alignItems={'center'}
      data-testid={dataTestId}
      onClick={event => {
        event?.preventDefault();
        onBannerClick();
      }}
    >
      <StyledText>{text}</StyledText>
      <SessionIconButton iconType={icon} iconColor="inherit" iconSize="small" />
    </StyledNoticeBanner>
  );
};

const StyledGroupInviteBanner = styled(Flex)`
  position: relative;
  background-color: var(--orange-color);
  color: var(--black-color);
  font-size: var(--font-size-sm);
  padding: var(--margins-xs) var(--margins-lg);
  text-align: center;
  flex-shrink: 0;

  // when part a a dialog, invert it and make it narrower (as the dialog grows to make it fit)
  ${StyledRootDialog} & {
    background-color: unset;
    color: var(--orange-color);
    max-width: 300px;
  }
`;

export const GroupInviteRequiredVersionBanner = () => {
  return (
    <StyledGroupInviteBanner data-testid="version-warning">
      {window.i18n('groupInviteVersion')}
    </StyledGroupInviteBanner>
  );
};
