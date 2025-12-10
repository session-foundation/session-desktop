import styled from 'styled-components';
import { useState } from 'react';
import { getAppDispatch } from '../../../../state/dispatch';

import {
  updateHideRecoveryPasswordModal,
  userSettingsModal,
  type UserSettingsModalState,
} from '../../../../state/ducks/modalDialog';
import {
  PanelButtonGroup,
  PanelButtonTextWithSubText,
  PanelLabelWithDescription,
} from '../../../buttons/panel/PanelButton';
import { ModalBasicHeader } from '../../../SessionWrapperModal';
import { ModalBackButton } from '../../shared/ModalBackButton';
import {
  useUserSettingsBackAction,
  useUserSettingsCloseAction,
  useUserSettingsTitle,
} from './userSettingsHooks';
import { SettingsPanelButtonInlineBasic } from '../components/SettingsPanelButtonInlineBasic';
import { useHideRecoveryPasswordEnabled } from '../../../../state/selectors/settings';
import { tr } from '../../../../localization/localeTools';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../../../basic/SessionButton';
import { useHotkey } from '../../../../hooks/useHotkey';
import { useIconToImageURL } from '../../../../hooks/useIconToImageURL';
import { usePasswordModal } from '../../../../hooks/usePasswordModal';
import { mnDecode } from '../../../../session/crypto/mnemonic';
import { useIsTopModal } from '../../../../state/selectors/modal';
import { THEME_GLOBALS } from '../../../../themes/globals';
import { getCurrentRecoveryPhrase } from '../../../../util/storage';
import { SessionQRCode, type QRCodeLogoProps } from '../../../SessionQRCode';

import { AnimatedFlex, Flex } from '../../../basic/Flex';
import { CopyToClipboardButton } from '../../../buttons';
import { UserSettingsModalContainer } from '../components/UserSettingsModalContainer';

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

export function RecoveryPasswordSettingsPage(modalState: UserSettingsModalState) {
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);
  const title = useUserSettingsTitle(modalState);
  const recoveryPasswordHidden = useHideRecoveryPasswordEnabled();
  const [fullScreen, setFullScreen] = useState(false);

  const recoveryPhrase = getCurrentRecoveryPhrase();
  if (!recoveryPhrase) {
    throw new Error('SettingsCategoryRecoveryPassword recovery seed is empty');
  }
  const hexEncodedSeed = mnDecode(recoveryPhrase, 'english');
  const [isQRVisible, setIsQRVisible] = useState(false);

  const isModalVisible = useIsTopModal('userSettingsModal');

  const { dataURL, iconSize, iconColor, backgroundColor, loading } = useIconToImageURL(qrLogoProps);

  const dispatch = getAppDispatch();

  const { hasPassword, passwordValid } = usePasswordModal({
    onClose: () => {
      dispatch(userSettingsModal({ userSettingsPage: 'default' }));
    },
  });

  if (recoveryPasswordHidden) {
    throw new Error('SettingsCategoryRecoveryPassword recovery password is hidden');
  }

  useHotkey(
    'v',
    () => {
      if (!isModalVisible) {
        setIsQRVisible(!isQRVisible);
      }
    },
    hasPassword && !passwordValid
  );

  if (hasPassword && !passwordValid) {
    return null;
  }

  return (
    <UserSettingsModalContainer
      headerChildren={
        <ModalBasicHeader
          title={title}
          bigHeader={true}
          showExitIcon={true}
          extraLeftButton={backAction ? <ModalBackButton onClick={backAction} /> : undefined}
        />
      }
      onClose={closeAction || undefined}
    >
      <PanelLabelWithDescription title={{ token: 'sessionRecoveryPassword' }} />
      <PanelButtonGroup
        style={{
          padding: 'var(--margins-lg) var(--margins-lg) var(--margins-md) var(--margins-lg)',
        }}
        /* we want some spacing between the items in this section */
        containerStyle={{ gap: 'var(--margins-md)' }}
      >
        <PanelButtonTextWithSubText
          text={{ token: 'yourRecoveryPassword' }}
          subText={{ token: 'recoveryPasswordDescription' }}
          textDataTestId="invalid-data-testid"
          subTextDataTestId="invalid-data-testid"
        />
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
            onToggleFullScreen={() => setFullScreen(!fullScreen)}
            fullScreen={fullScreen}
            ariaLabel={'Recovery Password QR Code'}
            dataTestId={'session-recovery-password'}
            style={{ alignSelf: 'center' }}
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
            <span data-testid="recovery-password-seed-modal" style={{ textAlign: 'center' }}>
              {recoveryPhrase}
            </span>
          </StyledRecoveryPassword>
        )}

        <Flex $container={true} $justifyContent={'space-around'}>
          {!isQRVisible && (
            <CopyToClipboardButton
              copyContent={recoveryPhrase}
              buttonType={SessionButtonType.Outline}
              buttonColor={SessionButtonColor.TextPrimary}
            />
          )}
          <SessionButton
            aria-label={isQRVisible ? 'View as password button' : 'View as QR code button'}
            onClick={() => {
              setIsQRVisible(!isQRVisible);
            }}
            style={{
              minWidth: 'var(--modal-actions-outline-min-width)',
            }}
          >
            {isQRVisible ? tr('recoveryPasswordView') : tr('qrView')}
          </SessionButton>
        </Flex>
      </PanelButtonGroup>
      {!recoveryPasswordHidden ? (
        <>
          <PanelLabelWithDescription title={{ token: 'recoveryPasswordVisibility' }} />
          <PanelButtonGroup>
            <SettingsPanelButtonInlineBasic
              baseDataTestId="hide-recovery-password"
              text={{ token: 'recoveryPasswordHideRecoveryPassword' }}
              subText={{ token: 'recoveryPasswordHideRecoveryPasswordDescription' }}
              onClick={async () => {
                dispatch(updateHideRecoveryPasswordModal({ state: 'firstWarning' }));
              }}
              buttonText={tr('hide')}
              buttonColor={SessionButtonColor.Danger}
            />
          </PanelButtonGroup>
        </>
      ) : null}
    </UserSettingsModalContainer>
  );
}
