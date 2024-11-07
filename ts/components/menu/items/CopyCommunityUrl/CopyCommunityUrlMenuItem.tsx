import { showCopyCommunityUrlMenuItem } from '.';
import { useIsPublic } from '../../../../hooks/useParamSelector';
import { copyPublicKeyByConvoId } from '../../../../interactions/conversationInteractions';
import { Localizer } from '../../../basic/Localizer';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';

export const CopyCommunityUrlMenuItem = ({ convoId }: { convoId: string }): JSX.Element | null => {
  const isPublic = useIsPublic(convoId);

  // we want to show the copyId for communities only

  if (showCopyCommunityUrlMenuItem({ isPublic })) {
    return (
      <ItemWithDataTestId
        onClick={() => {
          void copyPublicKeyByConvoId(convoId);
        }}
      >
        <Localizer token="communityUrlCopy" />
      </ItemWithDataTestId>
    );
  }
  return null;
};
