import { MenuItem } from '../MenuItem';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { Localizer } from '../../../basic/Localizer';
import { useSelectMessageViaMenuCb } from '../../../../hooks/useMessageInteractions';

export function SelectMessageMenuItem({ messageId }: { messageId: string }) {
  const selectViaMenu = useSelectMessageViaMenuCb(messageId);

  if (!selectViaMenu) {
    return null;
  }

  return (
    <MenuItem
      onClick={selectViaMenu}
      iconType={LUCIDE_ICONS_UNICODE.CIRCLE_CHECK}
      isDangerAction={false}
    >
      <Localizer token="select" />
    </MenuItem>
  );
}
