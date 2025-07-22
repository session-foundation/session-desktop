import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { SessionLucideIconButton } from '../icon/SessionIconButton';

export function StagedAttachmentsCloseButton(props: { onClick: () => void }) {
  return (
    <SessionLucideIconButton
      iconSize="medium"
      iconColor="var(--black-color)"
      backgroundColor="var(--white-color)"
      unicode={LUCIDE_ICONS_UNICODE.X}
      onClick={props.onClick}
      style={{
        position: 'absolute',
        top: 'var(--margins-xs)',
        right: 'var(--margins-xs)',
        zIndex: 1,
      }}
    />
  );
}
