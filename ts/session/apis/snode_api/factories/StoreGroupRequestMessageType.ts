import type { GroupUpdateDeleteMemberContentMessage } from '../../../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateDeleteMemberContentMessage';
import type { GroupUpdateInfoChangeMessage } from '../../../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateInfoChangeMessage';
import type { GroupUpdateMemberChangeMessage } from '../../../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateMemberChangeMessage';
import type { GroupUpdateMemberLeftNotificationMessage } from '../../../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateMemberLeftNotificationMessage';

export type StoreMessageToSubRequestType =
  | GroupUpdateMemberChangeMessage
  | GroupUpdateInfoChangeMessage
  | GroupUpdateDeleteMemberContentMessage
  | GroupUpdateMemberLeftNotificationMessage;
