import type { ReactNode } from 'react';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';

import { useIconToImageURL } from '../../../hooks/useIconToImageURL';
import { updateLightBoxOptions } from '../../../state/ducks/modalDialog';
import { prepareQRCodeForLightBox } from '../../../util/qrCodes';
import { QRCodeLogoProps, SessionQRCode } from '../../SessionQRCode';
import { Avatar, AvatarSize } from '../../avatar/Avatar';
import { Flex } from '../../basic/Flex';
import { SpacerSM } from '../../basic/Text';
import { ProfileDialogModes } from './EditProfileDialog';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';

const qrLogoProps: QRCodeLogoProps = {
  iconType: 'brandThin',
  iconSize: 42,
};

export const QRView = ({
  sessionID,
  setMode,
  children,
}: {
  sessionID: string;
  setMode: (mode: Extract<ProfileDialogModes, 'qr' | 'lightbox'>) => void;
  children?: ReactNode;
}) => {
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
        const lightBoxOptions = prepareQRCodeForLightBox(fileName, dataUrl, () => {
          setMode('qr');
        });
        dispatch(updateLightBoxOptions(lightBoxOptions));
        setMode('lightbox');
      }}
      ariaLabel={'Account ID QR code'}
      dataTestId={'your-qr-code'}
      // we need this for overflow buttons to be visible (see UserProfileModal)
      style={{ marginTop: '15px', position: 'relative' }}
    >
      {children}
    </SessionQRCode>
  );
};

type ProfileAvatarProps = {
  avatarPath: string | null;
  newAvatarObjectUrl?: string | null;
  profileName: string | undefined;
  conversationId: string;
  onPlusAvatarClick: (() => void) | null; // if null, plus icon won't be shown
  onAvatarClick: () => void; // on click on the avatar itself
  avatarSize: AvatarSize;
};

export const ProfileAvatar = (props: ProfileAvatarProps) => {
  const {
    newAvatarObjectUrl,
    avatarPath,
    profileName,
    conversationId,
    onAvatarClick,
    avatarSize,
    onPlusAvatarClick,
  } = props;
  return (
    <Avatar
      forcedAvatarPath={newAvatarObjectUrl || avatarPath}
      forcedName={profileName || conversationId}
      size={avatarSize}
      pubkey={conversationId}
      onAvatarClick={onAvatarClick}
      onPlusAvatarClick={onPlusAvatarClick ?? undefined}
    />
  );
};

type ProfileHeaderProps = ProfileAvatarProps & {
  onQRClick: (() => void) | null;
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
    onAvatarClick,
    onQRClick,
    avatarSize,
  } = props;

  return (
    <div className="avatar-center">
      <StyledAvatarCenterInner>
        <ProfileAvatar
          avatarPath={avatarPath}
          profileName={profileName}
          conversationId={conversationId}
          onAvatarClick={onAvatarClick}
          onPlusAvatarClick={onPlusAvatarClick}
          avatarSize={avatarSize}
        />
        {onQRClick ? (
          <SessionLucideIconButton
            unicode={LUCIDE_ICONS_UNICODE.QR_CODE}
            iconSize={avatarSize === AvatarSize.HUGE ? 'large' : 'medium'}
            iconColor="var(--black-color)"
            onClick={onQRClick}
            backgroundColor="var(--primary-color)"
            style={{
              position: 'absolute',
              top: 0,
              // this isn't ideal, but the button is not scaling with the avatar size so we need to hardcode its position
              insetInlineEnd: avatarSize === AvatarSize.HUGE ? '12%' : '4%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: avatarSize === AvatarSize.HUGE ? '40px' : '30px',
              width: avatarSize === AvatarSize.HUGE ? '40px' : '30px',
              borderRadius: '50%',
              transition: 'var(--default-duration)',
            }}
          />
        ) : null}
      </StyledAvatarCenterInner>
    </div>
  );
};

// We have a transparent border to match the dimensions of the SessionInput
const StyledProfileName = styled(Flex)`
  padding: 8px;
  border: 1px solid var(--transparent-color);

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

  return (
    <StyledProfileName $container={true} $justifyContent="center" $alignItems="center">
      <SessionLucideIconButton
        unicode={LUCIDE_ICONS_UNICODE.PENCIL}
        iconSize="medium"
        onClick={onClick}
        dataTestId="edit-profile-icon"
      />
      <SpacerSM />
      <StyledName data-testid="your-profile-name">{profileName}</StyledName>
    </StyledProfileName>
  );
};
