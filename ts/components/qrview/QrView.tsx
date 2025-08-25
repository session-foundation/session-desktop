import { useState } from 'react';
import { useIconToImageURL } from '../../hooks/useIconToImageURL';
import { AvatarExitQrCodeButton } from '../buttons/avatar/AvatarExitQrCodeButton';
import { QRCodeLogoProps, SessionQRCode } from '../SessionQRCode';

const qrLogoProps: QRCodeLogoProps = {
  iconType: 'brandThin',
  iconSize: 42,
};

export const QRView = ({ sessionID, onExit }: { sessionID: string; onExit: () => void }) => {
  const { dataURL, iconSize, iconColor, backgroundColor, loading } = useIconToImageURL(qrLogoProps);
  const [fullScreen, setFullScreen] = useState(false);

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
      onToggleFullScreen={() => setFullScreen(!fullScreen)}
      fullScreen={fullScreen}
      ariaLabel={'Account ID QR code'}
      dataTestId={'your-qr-code'}
      // we need this for overflow buttons to be visible (see UserProfileModal)
      style={fullScreen ? { position: 'fixed' } : { marginTop: '15px', position: 'relative' }}
    >
      <AvatarExitQrCodeButton onExitQrCodeView={onExit} />
    </SessionQRCode>
  );
};
