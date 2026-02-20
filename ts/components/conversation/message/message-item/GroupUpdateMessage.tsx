import {
  getGroupNameChangeStr,
  getJoinedGroupUpdateChangeStr,
  getKickedGroupUpdateStr,
  getLeftGroupUpdateChangeStr,
  getPromotedGroupUpdateChangeStr,
} from '../../../../models/groupUpdate';
import { PropsForGroupUpdateType } from '../../../../state/ducks/conversations';
import {
  useSelectedIsGroupV2,
  useSelectedNicknameOrProfileNameOrShortenedPubkey,
} from '../../../../state/selectors/selectedConversation';
import { Localizer } from '../../../basic/Localizer';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';
import { NotificationBubble } from './notification-bubble/NotificationBubble';
import type { WithContextMenuId, WithMessageId } from '../../../../session/types/with';
import { useMessageGroupUpdateChange } from '../../../../state/selectors';
import { assertUnreachable } from '../../../../types/sqlSharedTypes';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import type { TrArgs } from '../../../../localization/localeTools';
import type { WithPopoverPosition, WithSetPopoverPosition } from '../../../SessionTooltip';

// This component is used to display group updates in the conversation view.

function useChangeItem(change?: PropsForGroupUpdateType): TrArgs | null {
  const groupName = useSelectedNicknameOrProfileNameOrShortenedPubkey();
  const isGroupV2 = useSelectedIsGroupV2();

  if (!change) {
    return null;
  }
  const changeType = change.type;

  switch (changeType) {
    case 'left':
      if (!change.left.length) {
        throw new Error('Group update left is missing details');
      }
      return getLeftGroupUpdateChangeStr(change.left);
    case 'kicked':
      if (!change.kicked.length) {
        throw new Error('Group update kicked is missing details');
      }
      return getKickedGroupUpdateStr(change.kicked, groupName);
    case 'add':
      if (!change.added.length) {
        throw new Error('Group update added is missing details');
      }
      return getJoinedGroupUpdateChangeStr(change.added, isGroupV2, change.withHistory, groupName);
    case 'promoted':
      if (!change.promoted.length) {
        throw new Error('Group update promoted is missing details');
      }
      return getPromotedGroupUpdateChangeStr(change.promoted);
    case 'name':
      return getGroupNameChangeStr(change.newName);
    case 'avatarChange':
      return {
        token: 'groupDisplayPictureUpdated',
      };
    default:
      assertUnreachable(changeType, `invalid case: ${changeType}`);
      throw new Error('unhandled case, but this is to make typescript happy');
  }
}

// NOTE: [react-compiler] this convinces the compiler the hook is static
const useMessageGroupUpdateChangeInternal = useMessageGroupUpdateChange;

export const GroupUpdateMessage = (
  props: WithMessageId & WithPopoverPosition & WithSetPopoverPosition & WithContextMenuId
) => {
  const groupChange = useMessageGroupUpdateChangeInternal(props.messageId);

  const changeProps = useChangeItem(groupChange);

  if (!changeProps || !groupChange) {
    return null;
  }

  return (
    <ExpirableReadableMessage
      messageId={props.messageId}
      contextMenuId={props.contextMenuId}
      setTriggerPosition={props.setTriggerPosition}
      key={`readable-message-${props.messageId}`}
      dataTestId="group-update-message"
    >
      <NotificationBubble unicode={LUCIDE_ICONS_UNICODE.USERS_ROUND}>
        <Localizer {...changeProps} />
      </NotificationBubble>
    </ExpirableReadableMessage>
  );
};
