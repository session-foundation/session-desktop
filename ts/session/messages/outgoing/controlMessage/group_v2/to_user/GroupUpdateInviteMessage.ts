import { SignalService } from '../../../../../../protobuf';
import type { WithOutgoingUserProfile } from '../../../Message';
import { Preconditions } from '../../../preconditions';
import type { WithProMessageDetailsOrProto } from '../../../visibleMessage/VisibleMessage';
import { GroupUpdateMessageParams, GroupUpdateMessageWithProfile } from '../GroupUpdateMessage';

type Params = GroupUpdateMessageParams &
  WithOutgoingUserProfile &
  WithProMessageDetailsOrProto & {
    groupName: string;
    adminSignature: Uint8Array; // this is a signature of `"INVITE" || inviteeSessionId || timestamp`
    memberAuthData: Uint8Array;
  };

/**
 * GroupUpdateInviteMessage is sent as a 1o1 message to the recipient, not through the group's swarm.
 */
export class GroupUpdateInviteMessage extends GroupUpdateMessageWithProfile {
  public readonly groupName: Params['groupName'];
  public readonly adminSignature: Params['adminSignature'];
  public readonly memberAuthData: Params['memberAuthData'];

  constructor({ adminSignature, groupName, memberAuthData, ...others }: Params) {
    super({
      ...others,
    });

    this.groupName = groupName; // not sure if getting an invite with an empty group name should make us drop an incoming group invite (and the keys associated to it too)
    this.adminSignature = adminSignature;
    this.memberAuthData = memberAuthData;

    Preconditions.checkUin8tArrayOrThrow({
      data: adminSignature,
      expectedLength: 64,
      varName: 'adminSignature',
      context: this.constructor.toString(),
    });
    Preconditions.checkUin8tArrayOrThrow({
      data: memberAuthData,
      expectedLength: 100,
      varName: 'memberAuthData',
      context: this.constructor.toString(),
    });
  }

  public override dataProto(): SignalService.DataMessage {
    const inviteMessage = new SignalService.GroupUpdateInviteMessage({
      groupSessionId: this.destination,
      name: this.groupName,
      adminSignature: this.adminSignature,
      memberAuthData: this.memberAuthData,
    });

    const proto = super.makeDataProtoWithProfile();
    proto.groupUpdateMessage = { inviteMessage };
    return proto;
  }
}
