import { Localizer } from '../../../basic/Localizer';
import { useShowCopyCommunityUrlCb } from '../../../menuAndSettingsHooks/useCopyCommunityUrl';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';

export const CopyCommunityUrlMenuItem = ({ convoId }: { convoId: string }): JSX.Element | null => {
  const copyCommunityUrlCb = useShowCopyCommunityUrlCb(convoId);

  // we want to show the copyId for communities only
  if (copyCommunityUrlCb) {
    return (
      <ItemWithDataTestId onClick={copyCommunityUrlCb}>
        <Localizer token="communityUrlCopy" />
      </ItemWithDataTestId>
    );
  }
  return null;
};
