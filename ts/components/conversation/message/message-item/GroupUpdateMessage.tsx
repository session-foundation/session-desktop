import { PubkeyType } from 'libsession_util_nodejs';
import { isNull } from 'lodash';
import {
  getGroupNameChangeStr,
  getJoinedGroupUpdateChangeStr,
  getKickedGroupUpdateStr,
  getLeftGroupUpdateChangeStr,
  getPromotedGroupUpdateChangeStr,
} from '../../../../models/groupUpdate';
import { PreConditionFailed } from '../../../../session/utils/errors';
import {
  PropsForGroupUpdate,
  PropsForGroupUpdateType,
} from '../../../../state/ducks/conversations';
import {
  useSelectedIsGroupV2,
  useSelectedNicknameOrProfileNameOrShortenedPubkey,
} from '../../../../state/selectors/selectedConversation';
import type { LocalizerComponentPropsObject } from '../../../../types/localizer';
import { Localizer } from '../../../basic/Localizer';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';
import { NotificationBubble } from './notification-bubble/NotificationBubble';

// This component is used to display group updates in the conversation view.

const ChangeItemPromoted = (promoted: Array<PubkeyType>): LocalizerComponentPropsObject => {
  if (!promoted.length) {
    throw new Error('Group update promoted is missing contacts');
  }
  const isGroupV2 = useSelectedIsGroupV2();

  if (isGroupV2) {
    return getPromotedGroupUpdateChangeStr(promoted);
  }
  throw new PreConditionFailed('ChangeItemPromoted only applies to groupv2');
};

const ChangeItemAvatar = (): LocalizerComponentPropsObject => {
  const isGroupV2 = useSelectedIsGroupV2();
  if (isGroupV2) {
    return { token: 'groupDisplayPictureUpdated' };
  }
  throw new PreConditionFailed('ChangeItemAvatar only applies to groupv2');
};

const ChangeItemJoined = (
  added: Array<PubkeyType>,
  withHistory: boolean
): LocalizerComponentPropsObject => {
  const groupName = useSelectedNicknameOrProfileNameOrShortenedPubkey();
  const isGroupV2 = useSelectedIsGroupV2();

  if (!added.length) {
    throw new Error('Group update added is missing details');
  }
  return getJoinedGroupUpdateChangeStr(added, isGroupV2, withHistory, groupName);
};

const ChangeItemKicked = (kicked: Array<string>): LocalizerComponentPropsObject => {
  if (!kicked.length) {
    throw new Error('Group update kicked is missing details');
  }
  const groupName = useSelectedNicknameOrProfileNameOrShortenedPubkey();

  return getKickedGroupUpdateStr(kicked, groupName);
};

const ChangeItemLeft = (left: Array<string>): LocalizerComponentPropsObject => {
  if (!left.length) {
    throw new Error('Group update left is missing details');
  }

  return getLeftGroupUpdateChangeStr(left);
};

const ChangeItem = (change: PropsForGroupUpdateType): LocalizerComponentPropsObject => {
  const { type } = change;

  switch (type) {
    case 'name':
      return getGroupNameChangeStr(change.newName);
    case 'add':
      return ChangeItemJoined(change.added, change.withHistory);
    case 'left':
      return ChangeItemLeft(change.left);
    case 'kicked':
      return ChangeItemKicked(change.kicked);
    case 'promoted':
      return ChangeItemPromoted(change.promoted);
    case 'avatarChange':
      return ChangeItemAvatar();
    default:
      return { token: 'groupUpdated' };
  }
};

export const GroupUpdateMessage = (props: PropsForGroupUpdate) => {
  const { change, messageId } = props;

  const changeItem = ChangeItem(change);

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      key={`readable-message-${messageId}`}
      dataTestId="group-update-message"
      isControlMessage={true}
    >
      <NotificationBubble iconType="users">
        {!isNull(changeItem) ? <Localizer {...changeItem} /> : null}
      </NotificationBubble>
    </ExpirableReadableMessage>
  );
};
