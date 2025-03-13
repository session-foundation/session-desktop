import { useConvoIdFromContext } from '../../../../contexts/ConvoIdContext';
import {
  useConversationUsername,
  useIsKickedFromGroup,
  useIsClosedGroup,
  useIsPublic,
  useIsGroupDestroyed,
} from '../../../../hooks/useParamSelector';
import { showDeleteGroupByConvoId } from '../../../../interactions/conversationInteractions';
import { PubKey } from '../../../../session/types';
import { useIsMessageRequestOverlayShown } from '../../../../state/selectors/section';
import { ItemWithDataTestId } from '../MenuItemWithDataTestId';
import { showDeleteGroupItem } from './guard';
import { Localizer } from '../../../basic/Localizer';
import { useDisableLegacyGroupDeprecatedActions } from '../../../../hooks/useRefreshReleasedFeaturesTimestamp';
import { useConversationIsExpired03Group } from '../../../../state/selectors/selectedConversation';

export const DeleteGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const username = useConversationUsername(convoId) || convoId;
  const isGroup = useIsClosedGroup(convoId);
  const isMessageRequestShown = useIsMessageRequestOverlayShown();
  const isKickedFromGroup = useIsKickedFromGroup(convoId) || false;
  const isPublic = useIsPublic(convoId);
  const isGroupDestroyed = useIsGroupDestroyed(convoId);

  const is03GroupExpired = useConversationIsExpired03Group(convoId);

  const showLeave = showDeleteGroupItem({
    isGroup,
    isKickedFromGroup,
    isMessageRequestShown,
    isPublic,
    isGroupDestroyed,
    is03GroupExpired,
  });

  if (!showLeave) {
    return null;
  }

  const token = PubKey.is03Pubkey(convoId) ? 'groupDelete' : 'conversationsDelete';

  return (
    <ItemWithDataTestId
      onClick={() => {
        void showDeleteGroupByConvoId(convoId, username);
      }}
    >
      <Localizer token={token} />
    </ItemWithDataTestId>
  );
};

export const DeleteDeprecatedLegacyGroupMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const username = useConversationUsername(convoId) || convoId;

  const shortCircuitDeleteDeprecatedGroup = useDisableLegacyGroupDeprecatedActions(convoId);

  if (!shortCircuitDeleteDeprecatedGroup) {
    return null;
  }

  const token = 'groupDelete';

  return (
    <ItemWithDataTestId
      onClick={() => {
        void showDeleteGroupByConvoId(convoId, username);
      }}
    >
      <Localizer token={token} />
    </ItemWithDataTestId>
  );
};
