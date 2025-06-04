import { Localizer } from '../../../basic/Localizer';
import { useShowCopyAccountIdCb } from '../../../menuAndSettingsHooks/useCopyAccountId';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';

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
      <Localizer token="accountIDCopy" />
    </ItemWithDataTestId>
  );
};
