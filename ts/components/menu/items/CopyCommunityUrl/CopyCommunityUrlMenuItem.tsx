import type { JSX } from 'react';
import { Localizer } from '../../../basic/Localizer';
import { useShowCopyCommunityUrlCb } from '../../../menuAndSettingsHooks/useCopyCommunityUrl';
import { MenuItem } from '../MenuItem';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';

export const CopyCommunityUrlMenuItem = ({ convoId }: { convoId: string }): JSX.Element | null => {
  const copyCommunityUrlCb = useShowCopyCommunityUrlCb(convoId);

  // we want to show the copyId for communities only
  if (copyCommunityUrlCb) {
    return (
      <MenuItem
        onClick={copyCommunityUrlCb}
        iconType={LUCIDE_ICONS_UNICODE.COPY}
        isDangerAction={false}
      >
        <Localizer token="communityUrlCopy" />
      </MenuItem>
    );
  }
  return null;
};
