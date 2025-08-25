import { useDispatch } from 'react-redux';
import { useIconToImageURL } from '../../hooks/useIconToImageURL';
import { updateLightBoxOptions } from '../../state/ducks/modalDialog';
import { prepareQRCodeForLightBox } from '../../util/qrCodes';
import { AvatarExitQrCodeButton } from '../buttons/avatar/AvatarExitQrCodeButton';
import { QRCodeLogoProps, SessionQRCode } from '../SessionQRCode';

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
