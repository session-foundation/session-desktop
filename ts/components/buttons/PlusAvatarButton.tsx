import type { SessionDataTestId } from 'react';
import { SessionIconButton } from '../icon';
import { useIsRtl } from '../../util/i18n/rtlSupport';

export const PlusAvatarButton = ({
  onClick,
  dataTestId,
}: {
  onClick?: () => void;
  dataTestId?: SessionDataTestId;
}) => {
  const isRtl = useIsRtl();

  return (
    <SessionIconButton
      iconType="plusFat"
      iconSize={23}
      iconColor="var(--modal-background-content-color)"
      iconPadding="5px"
      borderRadius="50%"
      backgroundColor="var(--primary-color)"
      onClick={onClick}
      dataTestId={dataTestId}
      padding="0"
      style={{
        position: 'absolute',
        bottom: 0,
        right: isRtl ? undefined : 0,
        left: isRtl ? 0 : undefined,
      }}
    />
  );
};
