import { focusVisibleBoxShadowOutsetStr } from '../../../styles/focusVisible';
import { SessionIconButton } from '../../icon/SessionIconButton';

export function AvatarExitQrCodeButton({ onExitQrCodeView }: { onExitQrCodeView: () => void }) {
  return (
    <SessionIconButton
      iconType="userRoundFilled"
      iconSize={'huge'}
      backgroundColor="var(--primary-color)"
      iconColor="var(--black-color)"
      padding="var(--margins-xs)"
      onClick={onExitQrCodeView}
      focusVisibleEffect={focusVisibleBoxShadowOutsetStr()}
      style={{
        position: 'absolute',
        top: '-15px',
        insetInlineEnd: '-15px',
        display: 'flex',
        alignItems: 'center',
      }}
      borderRadius="50%"
      iconPadding="var(--margins-xs)"
    />
  );
}
