import { useIsPrivate } from '../../../../hooks/useParamSelector';
import { copyPublicKeyByConvoId } from '../../../../interactions/conversationInteractions';
import { Localizer } from '../../../basic/Localizer';
import { showCopyAccountIdAction } from '.';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';

/**
 * Can be used to copy the conversation AccountID or the message's author sender'id.
 * Depending on what the pubkey is
 */
export const CopyAccountIdMenuItem = ({ pubkey }: { pubkey: string }): JSX.Element | null => {
  const isPrivate = useIsPrivate(pubkey);

  // we want to show the copyId for communities only

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
