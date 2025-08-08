import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';

export const ModalBackButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <SessionLucideIconButton
      unicode={LUCIDE_ICONS_UNICODE.CHEVRON_LEFT}
      onClick={onClick}
      iconSize="large"
      iconColor="var(--text-primary-color)"
    />
  );
};
