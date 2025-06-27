import type { SessionDataTestId } from 'react';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

export const PlusAvatarButton = ({
  onClick,
  dataTestId,
}: {
  onClick?: () => void;
  dataTestId?: SessionDataTestId;
}) => {
  return (
    <SessionLucideIconButton
      unicode={LUCIDE_ICONS_UNICODE.PLUS}
      iconSize={'medium'}
      iconColor="var(--modal-background-content-color)"
      onClick={onClick}
      dataTestId={dataTestId}
      backgroundColor="var(--primary-color)"
      style={{
        position: 'absolute',
        bottom: '11%',
        insetInlineEnd: 0,
        boxShadow: '0px 0px 3px 2px var(--border-color)',
      }}
    />
  );
};
