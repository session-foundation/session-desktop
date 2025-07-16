import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { useHotkey } from '../../../hooks/useHotkey';
import { useIconToImageURL } from '../../../hooks/useIconToImageURL';
import { usePasswordModal } from '../../../hooks/usePasswordModal';
import { mnDecode } from '../../../session/crypto/mnemonic';
import {
  updateHideRecoveryPasswordModal,
  updateLightBoxOptions,
} from '../../../state/ducks/modalDialog';
import { getIsModalVisible } from '../../../state/selectors/modal';
import { useHideRecoveryPasswordEnabled } from '../../../state/selectors/settings';
import { THEME_GLOBALS } from '../../../themes/globals';
import { prepareQRCodeForLightBox } from '../../../util/qrCodes';
import { getCurrentRecoveryPhrase } from '../../../util/storage';
import { QRCodeLogoProps, SessionQRCode } from '../../SessionQRCode';
import { AnimatedFlex } from '../../basic/Flex';
import { Localizer } from '../../basic/Localizer';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { SpacerMD, SpacerSM } from '../../basic/Text';
import { CopyToClipboardIcon } from '../../buttons/CopyToClipboardButton';
import {
  SessionSettingButtonItem,
  SessionSettingsItemWrapper,
  StyledSettingItem,
} from '../SessionSettingListItem';
import { sectionActions } from '../../../state/ducks/section';
import { localize } from '../../../localization/localeTools';

const StyledSettingsItemContainer = styled.div`
  p {
    font-size: var(--font-size-md);
    line-height: 30px;
    margin: 0;
  }

  button[data-testid='hide-recovery-password-button'] {
    width: 130px;
  }

  ${StyledSettingItem} {
    svg {
      margin-top: -2px;
    }
  }
`;

const StyledRecoveryPassword = styled(AnimatedFlex)<{ color: string }>`
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-align: justify;
  user-select: text;
  border: 2px solid var(--text-secondary-color);
  border-radius: 11px;
  padding: var(--margins-sm) var(--margins-sm) var(--margins-sm) var(--margins-md);
  margin: 0;
  max-width: fit-content;
  color: ${props => props.color};
`;

const qrLogoProps: QRCodeLogoProps = {
  iconType: 'shield',
  iconSize: 56,
};

export const SettingsCategoryRecoveryPassword = () => {
  const recoveryPhrase = getCurrentRecoveryPhrase();
  if (!recoveryPhrase) {
    throw new Error('SettingsCategoryRecoveryPassword recovery seed is empty');
  }
  const hexEncodedSeed = mnDecode(recoveryPhrase, 'english');
  const [isQRVisible, setIsQRVisible] = useState(false);

  const hideRecoveryPassword = useHideRecoveryPasswordEnabled();
  const isModalVisible = useSelector(getIsModalVisible);

  const { dataURL, iconSize, iconColor, backgroundColor, loading } = useIconToImageURL(qrLogoProps);

  const dispatch = useDispatch();

  const { hasPassword, passwordValid } = usePasswordModal({
    onClose: () => {
      dispatch(sectionActions.showSettingsSection('privacy'));
    },
  });

  useHotkey(
    'v',
    () => {
      if (!isModalVisible) {
        setIsQRVisible(!isQRVisible);
      }
    },
    (hasPassword && !passwordValid) || hideRecoveryPassword
  );

  if ((hasPassword && !passwordValid) || hideRecoveryPassword) {
    return null;
  }

  return (
    <StyledSettingsItemContainer>
      <SessionSettingsItemWrapper
        title={localize('sessionRecoveryPassword').toString()}
        icon={{
          iconType: 'recoveryPasswordFill',
          iconSize: 18,
          iconColor: 'var(--text-primary-color)',
        }}
        description={<Localizer token="recoveryPasswordDescription" />}
        inline={false}
      >
        <SpacerMD />
        {isQRVisible ? (
          <SessionQRCode
            id={'session-recovery-password'}
            value={hexEncodedSeed}
            size={260}
            backgroundColor={backgroundColor}
            foregroundColor={iconColor}
            hasLogo={qrLogoProps}
            logoImage={dataURL}
            logoSize={iconSize}
            loading={loading}
            onClick={(fileName, dataUrl) => {
              const lightBoxOptions = prepareQRCodeForLightBox(fileName, dataUrl);
              window.inboxStore?.dispatch(updateLightBoxOptions(lightBoxOptions));
            }}
            ariaLabel={'Recovery Password QR Code'}
            dataTestId={'session-recovery-password'}
          />
        ) : (
          <StyledRecoveryPassword
            aria-label="Recovery password"
            $container={true}
            $flexDirection={'row'}
            $justifyContent={'space-between'}
            $alignItems={'center'}
            width={'100%'}
            color={'var(--renderer-span-primary-color)'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: THEME_GLOBALS['--default-duration-seconds'] }}
          >
            <span data-testid="recovery-password-seed-modal">{recoveryPhrase}</span>
            <SpacerSM />
            <CopyToClipboardIcon
              copyContent={recoveryPhrase}
              iconSize={'large'}
              iconColor={'var(--text-primary-color)'}
              hotkey={!isModalVisible}
            />
          </StyledRecoveryPassword>
        )}

        <SpacerMD />
        <SessionButton
          aria-label={isQRVisible ? 'View as password button' : 'View as QR code button'}
          onClick={() => {
            setIsQRVisible(!isQRVisible);
          }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: isQRVisible ? undefined : 'var(--margins-xs)',
            marginLeft: isQRVisible ? '-8px' : undefined,
          }}
        >
          {isQRVisible
            ? localize('recoveryPasswordView').toString()
            : localize('qrView').toString()}
        </SessionButton>
      </SessionSettingsItemWrapper>
      {!hideRecoveryPassword ? (
        <SessionSettingButtonItem
          title={localize('recoveryPasswordHideRecoveryPassword').toString()}
          description={localize('recoveryPasswordHideRecoveryPasswordDescription').toString()}
          onClick={() => {
            dispatch(updateHideRecoveryPasswordModal({ state: 'firstWarning' }));
          }}
          buttonText={localize('hide').toString()}
          buttonColor={SessionButtonColor.Danger}
          dataTestId={'hide-recovery-password-button'}
        />
      ) : null}
    </StyledSettingsItemContainer>
  );
};
