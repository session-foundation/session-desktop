import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';

export function ModalPencilIcon(props: { onClick: () => void }) {
  return (
    <SessionLucideIconButton
      unicode={LUCIDE_ICONS_UNICODE.PENCIL}
      onClick={props.onClick}
      iconSize="large"
      dataTestId="modal-pencil-button"
      iconColor="var(--text-primary-color)"
    />
  );
}
