import { useIsPrivate } from '../../../../hooks/useParamSelector';
import { copyPublicKeyByConvoId } from '../../../../interactions/conversationInteractions';
import { Localizer } from '../../../basic/Localizer';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { showCopyAccountIdAction } from './guard';

/**
 * Can be used to copy the conversation AccountID or the message's author sender'id.
 * Depending on what the pubkey is
 */
export const CopyAccountIdMenuItem = ({ pubkey }: { pubkey: string }): JSX.Element | null => {
  const isPrivate = useIsPrivate(pubkey);

  if (showCopyAccountIdAction({ isPrivate, pubkey })) {
    return (
      <ItemWithDataTestId
        onClick={() => {
          void copyPublicKeyByConvoId(pubkey);
        }}
      >
        <Localizer token="accountIDCopy" />
      </ItemWithDataTestId>
    );
  }
  return null;
};
