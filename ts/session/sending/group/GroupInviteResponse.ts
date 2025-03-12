import { GroupPubkeyType } from 'libsession_util_nodejs';
import { GroupUpdateInviteResponseMessage } from '../../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateInviteResponseMessage';
import { ed25519Str } from '../../utils/String';
import { NetworkTime } from '../../../util/NetworkTime';
import { MessageQueue } from '../MessageQueue';

/**
 * Send the invite response to the group's swarm. An admin will handle it and update our invite pending state to not pending.
 * NOTE:
 *  This message can only be sent once we got the keys for the group, through a poll of the swarm.
 */
export async function sendInviteResponseToGroup({ groupPk }: { groupPk: GroupPubkeyType }) {
  window.log.info(`sendInviteResponseToGroup for group ${ed25519Str(groupPk)}`);

  await MessageQueue.use().sendToGroupV2({
    message: new GroupUpdateInviteResponseMessage({
      groupPk,
      isApproved: true,
      createAtNetworkTimestamp: NetworkTime.now(),
      expirationType: 'unknown', // an invite response should not expire
      expireTimer: 0,
    }),
  });
}
