import type { JSX } from 'react';
import { Localizer } from '../../../basic/Localizer';
import { useShowCopyAccountIdCb } from '../../../menuAndSettingsHooks/useCopyAccountId';
import { MenuItem } from '../MenuItem';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';

/**
 * Can be used to copy the conversation AccountID or the message's author sender'id.
 * Depending on what the pubkey is
 */
export const CopyAccountIdMenuItem = ({
  pubkey,
  messageId,
}: {
  pubkey: string | undefined;
  messageId: string | undefined;
}): JSX.Element | null => {
  const copyAccountIdCb = useShowCopyAccountIdCb({ sender: pubkey, messageId });

  if (!copyAccountIdCb) {
    return null;
  }

  return (
    <MenuItem onClick={copyAccountIdCb} iconType={LUCIDE_ICONS_UNICODE.COPY} isDangerAction={false}>
      <Localizer token="accountIDCopy" />
    </MenuItem>
  );
};
