import { AvatarSize } from '../avatar/Avatar';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { useAvatarActionPosition } from './PlusAvatarButton';

export function AvatarQrCodeButton({
  avatarSize,
  onQRClick,
}: {
  avatarSize: AvatarSize;
  onQRClick?: (() => void) | null;
}) {
  const hardcodedPosition = useAvatarActionPosition(avatarSize, 'top');
  if (!onQRClick) {
    return null;
  }
  return (
    <SessionLucideIconButton
      unicode={LUCIDE_ICONS_UNICODE.QR_CODE}
      iconSize={avatarSize === AvatarSize.HUGE ? 'large' : 'medium'}
      iconColor="var(--black-color)"
      onClick={onQRClick}
      backgroundColor="var(--primary-color)"
      padding="var(--margins-xs)"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        transition: 'filter var(--default-duration)',
        ...hardcodedPosition,
      }}
    />
  );
}
