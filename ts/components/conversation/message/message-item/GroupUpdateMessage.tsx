import { isNull } from 'lodash';
import {
  getJoinedGroupUpdateChangeStr,
  getKickedGroupUpdateStr,
  getLeftGroupUpdateChangeStr,
} from '../../../../models/groupUpdate';
import {
  PropsForGroupUpdate,
  PropsForGroupUpdateType,
} from '../../../../state/ducks/conversations';
import { useSelectedNicknameOrProfileNameOrShortenedPubkey } from '../../../../state/selectors/selectedConversation';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';
import { NotificationBubble } from './notification-bubble/NotificationBubble';
import { Localizer } from '../../../basic/Localizer';
import type { LocalizerComponentPropsObject } from '../../../../types/localizer';

// This component is used to display group updates in the conversation view.

const ChangeItemJoined = (added: Array<string>): LocalizerComponentPropsObject => {
  const groupName = useSelectedNicknameOrProfileNameOrShortenedPubkey();

  if (!added.length) {
    throw new Error('Group update added is missing details');
  }

  return getJoinedGroupUpdateChangeStr(added, groupName);
};

const ChangeItemKicked = (kicked: Array<string>): LocalizerComponentPropsObject => {
  if (!kicked.length) {
    throw new Error('Group update kicked is missing details');
  }
  const groupName = useSelectedNicknameOrProfileNameOrShortenedPubkey();

  return getKickedGroupUpdateStr(kicked, groupName);
};

const ChangeItemLeft = (left: Array<string>): LocalizerComponentPropsObject => {
  const groupName = useSelectedNicknameOrProfileNameOrShortenedPubkey();

  if (!left.length) {
    throw new Error('Group update left is missing details');
  }

  return getLeftGroupUpdateChangeStr(left, groupName);
};

const ChangeItem = (change: PropsForGroupUpdateType): LocalizerComponentPropsObject => {
  const { type } = change;
  switch (type) {
    case 'name':
      return { token: 'groupNameNew', args: { group_name: change.newName } };

    case 'add':
      return ChangeItemJoined(change.added);

    case 'left':
      return ChangeItemLeft(change.left);

    case 'kicked':
      return ChangeItemKicked(change.kicked);

    case 'general':
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
