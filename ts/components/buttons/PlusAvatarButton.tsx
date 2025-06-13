import type { SessionDataTestId } from 'react';
import { useIsRtl } from '../../util/i18n/rtlSupport';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

export const PlusAvatarButton = ({
  onClick,
  dataTestId,
}: {
  onClick?: () => void;
  dataTestId?: SessionDataTestId;
}) => {
  const isRtl = useIsRtl();

  return (
    <SessionLucideIconButton
      unicode={LUCIDE_ICONS_UNICODE.PLUS}
      iconSize={'medium'}
      iconColor="var(--modal-background-content-color)"
      onClick={onClick}
      dataTestId={dataTestId}
      padding="3px 0 0 0 "
      style={{
        position: 'absolute',
        bottom: 0,
        right: isRtl ? undefined : 0,
        left: isRtl ? 0 : undefined,
        borderRadius: '50%',
        backgroundColor: 'var(--primary-color)',
        aspectRatio: '1',
      }}
    />
  );
};
