import { type SessionDataTestId } from 'react';
import styled from 'styled-components';

import { Avatar, AvatarSize } from '../../avatar/Avatar';
import { Flex } from '../../basic/Flex';
import { useProBadgeOnClickCb } from '../../menuAndSettingsHooks/useProBadgeOnClickCb';
import { useCurrentUserHasPro } from '../../../hooks/useHasPro';
import { ProIconButton } from '../../buttons/ProButton';
import { AvatarQrCodeButton } from '../../buttons/avatar/AvatarQrCodeButton';

type ProfileAvatarProps = {
  avatarPath: string | null;
  newAvatarObjectUrl?: string | null;
  conversationId: string;
  onAvatarClick: () => void; // on click on the avatar itself
  onPlusAvatarClick: (() => void) | null; // if null, plus icon won't be shown
  avatarSize: AvatarSize;
  dataTestId: SessionDataTestId;
};

export const ProfileAvatar = (props: ProfileAvatarProps) => {
  const {
    newAvatarObjectUrl,
    avatarPath,
    conversationId,
    avatarSize,
    onAvatarClick,
    onPlusAvatarClick,
    dataTestId,
  } = props;
  return (
    <Avatar
      forcedAvatarPath={newAvatarObjectUrl || avatarPath}
      size={avatarSize}
      pubkey={conversationId}
      onAvatarClick={onAvatarClick}
      onPlusAvatarClick={onPlusAvatarClick ?? undefined}
      dataTestId={dataTestId}
    />
  );
};

type ProfileHeaderProps = Omit<ProfileAvatarProps, 'onAvatarClick' | 'avatarSize'> & {
  onQRClick: (() => void) | null;
  enlargedImage: boolean;
  toggleEnlargedImage: () => void;
};

const StyledAvatarCenterInner = styled.div`
  position: relative;
`;

export const ProfileHeader = (props: ProfileHeaderProps) => {
  const {
    avatarPath,
    conversationId,
    onPlusAvatarClick,
    onQRClick,
    dataTestId,
    enlargedImage,
    toggleEnlargedImage,
  } = props;

  const avatarSize = enlargedImage ? AvatarSize.HUGE : AvatarSize.XL;

  return (
    <div>
      <StyledAvatarCenterInner>
        <ProfileAvatar
          avatarPath={avatarPath}
          conversationId={conversationId}
          onAvatarClick={toggleEnlargedImage}
          onPlusAvatarClick={onPlusAvatarClick}
          avatarSize={avatarSize}
          dataTestId={dataTestId}
        />
        <AvatarQrCodeButton avatarSize={avatarSize} onQRClick={onQRClick} />
      </StyledAvatarCenterInner>
    </div>
  );
};

// We have a transparent border to match the dimensions of the SessionInput
const StyledProfileName = styled(Flex)`
  padding: 8px;
  border: 1px solid var(--transparent-color);
  gap: var(--margins-xs);

  .session-icon-button {
    padding: 0px;
  }
`;

const StyledName = styled.p`
  font-size: var(--font-size-xl);
  line-height: 1.4;
  font-weight: 700;
  font-size: var(--font-size-h4);
  margin: 0;
  text-align: center;
  padding: 0px;
  cursor: pointer;
`;

export const ProfileName = (props: { profileName: string; onClick: () => void }) => {
  const { profileName, onClick } = props;

  const currentUserHasPro = useCurrentUserHasPro();

  const showPro = useProBadgeOnClickCb({
    context: 'show-our-profile-dialog',
    args: { currentUserHasPro, providedCb: onClick },
  });

  return (
    <StyledProfileName $container={true} $justifyContent="center" $alignItems="center">
      <StyledName data-testid="your-profile-name" onClick={onClick}>
        {profileName}
      </StyledName>
      {showPro.show ? (
        <ProIconButton
          iconSize={'medium'}
          dataTestId="pro-badge-profile-name"
          onClick={showPro.cb}
        />
      ) : null}
    </StyledProfileName>
  );
};
