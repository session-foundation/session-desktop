import { type SessionDataTestId } from 'react';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';

import { useIconToImageURL } from '../../../hooks/useIconToImageURL';
import { updateLightBoxOptions } from '../../../state/ducks/modalDialog';
import { prepareQRCodeForLightBox } from '../../../util/qrCodes';
import { QRCodeLogoProps, SessionQRCode } from '../../SessionQRCode';
import { Avatar, AvatarSize } from '../../avatar/Avatar';
import { Flex } from '../../basic/Flex';
import { useProBadgeOnClickCb } from '../../menuAndSettingsHooks/useProBadgeOnClickCb';
import { useCurrentUserHasPro } from '../../../hooks/useHasPro';
import { ProIconButton } from '../../buttons/ProButton';
import { AvatarQrCodeButton } from '../../buttons/AvatarQrCodeButton';
import { AvatarExitQrCodeButton } from '../../buttons/AvatarExitQrCodeButton';

const qrLogoProps: QRCodeLogoProps = {
  iconType: 'brandThin',
  iconSize: 42,
};

export const QRView = ({ sessionID, onExit }: { sessionID: string; onExit: () => void }) => {
  const dispatch = useDispatch();
  const { dataURL, iconSize, iconColor, backgroundColor, loading } = useIconToImageURL(qrLogoProps);

  return (
    <SessionQRCode
      id={'session-account-id'}
      value={sessionID}
      size={190}
      backgroundColor={backgroundColor}
      foregroundColor={iconColor}
      hasLogo={qrLogoProps}
      logoImage={dataURL}
      logoSize={iconSize}
      loading={loading}
      onClick={(fileName, dataUrl) => {
        const lightBoxOptions = prepareQRCodeForLightBox(fileName, dataUrl);
        dispatch(updateLightBoxOptions(lightBoxOptions));
      }}
      ariaLabel={'Account ID QR code'}
      dataTestId={'your-qr-code'}
      // we need this for overflow buttons to be visible (see UserProfileModal)
      style={{ marginTop: '15px', position: 'relative' }}
    >
      <AvatarExitQrCodeButton onExitQrCodeView={onExit} />
    </SessionQRCode>
  );
};

type ProfileAvatarProps = {
  avatarPath: string | null;
  newAvatarObjectUrl?: string | null;
  profileName?: string;
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
    profileName,
    conversationId,
    avatarSize,
    onAvatarClick,
    onPlusAvatarClick,
    dataTestId,
  } = props;
  return (
    <Avatar
      forcedAvatarPath={newAvatarObjectUrl || avatarPath}
      forcedName={profileName || conversationId}
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
    profileName,
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
          profileName={profileName}
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
  margin: 0;
  padding: 0px;
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
