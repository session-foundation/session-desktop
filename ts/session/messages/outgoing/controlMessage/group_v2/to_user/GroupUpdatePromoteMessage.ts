import { GroupPubkeyType } from 'libsession_util_nodejs';
import { SignalService } from '../../../../../../protobuf';
import { GroupUpdateMessageParams, GroupUpdateMessageWithProfile } from '../GroupUpdateMessage';
import type { WithOutgoingUserProfile } from '../../../Message';
import type { OutgoingProMessageDetailsOrProto } from '../../../visibleMessage/VisibleMessage';

type Params = GroupUpdateMessageParams &
  WithOutgoingUserProfile & {
    groupPk: GroupPubkeyType;
    groupIdentitySeed: Uint8Array;
    groupName: string;
    outgoingProMessageDetails: OutgoingProMessageDetailsOrProto;
  };

/**
 * GroupUpdatePromoteMessage is sent as a 1o1 message to the recipient, not through the group's swarm.
 */
export class GroupUpdatePromoteMessage extends GroupUpdateMessageWithProfile {
  public readonly groupIdentitySeed: Params['groupIdentitySeed'];
  public readonly groupName: Params['groupName'];

  constructor(params: Params) {
    super(params);

    this.groupIdentitySeed = params.groupIdentitySeed;
    this.groupName = params.groupName;
    if (!this.groupIdentitySeed || this.groupIdentitySeed.length !== 32) {
      throw new Error('groupIdentitySeed must be set');
    }
    if (!this.groupName) {
      throw new Error('name must be set and not empty');
    }
  }

  public override dataProto(): SignalService.DataMessage {
    const promoteMessage = new SignalService.GroupUpdatePromoteMessage({
      groupIdentitySeed: this.groupIdentitySeed,
      name: this.groupName,
    });

    const proto = super.makeDataProtoWithProfile();
    proto.groupUpdateMessage = { promoteMessage };
    return proto;
  }
}
