import type { SessionDataTestId } from 'react';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

export const PlusAvatarButton = ({
  onClick,
  dataTestId,
  isEdit,
}: {
  onClick?: () => void;
  /**
   * if true, the button will be a pencil icon, otherwise a plus icon
   */
  isEdit: boolean;
  dataTestId?: SessionDataTestId;
}) => {
  return (
    <SessionLucideIconButton
      unicode={isEdit ? LUCIDE_ICONS_UNICODE.PENCIL : LUCIDE_ICONS_UNICODE.PLUS}
      iconSize={isEdit ? 'small' : 'medium'}
      iconColor="var(--modal-background-content-color)"
      onClick={onClick}
      dataTestId={dataTestId}
      backgroundColor="var(--primary-color)"
      padding={isEdit ? 'var(--margins-xs)' : 'var(--margins-xxs)'}
      style={{
        position: 'absolute',
        bottom: '3%',
        insetInlineEnd: 0,
        boxShadow: '0px 0px 3px 2px var(--border-color)',
      }}
    />
  );
};
