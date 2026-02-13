import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';

export function AvatarExitQrCodeButton({ onExitQrCodeView }: { onExitQrCodeView: () => void }) {
  return (
    <SessionLucideIconButton
      unicode={LUCIDE_ICONS_UNICODE.USER_ROUND}
      iconSize={'large'}
      backgroundColor="var(--primary-color)"
      iconColor="var(--black-color)"
      padding="var(--margins-xs)"
      onClick={onExitQrCodeView}
      style={{
        position: 'absolute',
        top: '-15px',
        insetInlineEnd: '-15px',
        display: 'flex',
        alignItems: 'center',
        borderRadius: '50%',
        boxShadow: 'var(--box-shadow-focus-visible-outset)',
      }}
    />
  );
}
