import type { JSX } from 'react';
import { Localizer } from '../../../basic/Localizer';
import { useShowCopyAccountIdCb } from '../../../menuAndSettingsHooks/useCopyAccountId';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { SessionLucideIconButton } from '../../../icon/SessionIconButton';
import { SpacerSM } from '../../../basic/Text';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';

/**
 * Can be used to copy the conversation AccountID or the message's author sender'id.
 * Depending on what the pubkey is
 */
export const CopyAccountIdMenuItem = ({ pubkey }: { pubkey: string }): JSX.Element | null => {
  const copyAccountIdCb = useShowCopyAccountIdCb(pubkey);

  if (!copyAccountIdCb) {
    return null;
  }

  return (
    <ItemWithDataTestId onClick={copyAccountIdCb}>
      <SessionLucideIconButton
        iconSize="medium"
        iconColor="inherit"
        unicode={LUCIDE_ICONS_UNICODE.COPY}
      />
      <SpacerSM />
      <Localizer token="accountIDCopy" />
    </ItemWithDataTestId>
  );
};
