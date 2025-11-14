import { SignalService } from '../../../../../../protobuf';
import { ContentMessage } from '../../../ContentMessage';
import type { WithOutgoingUserProfile } from '../../../Message';
import { Preconditions } from '../../../preconditions';
import type { WithProMessageDetailsOrProto } from '../../../visibleMessage/VisibleMessage';
import { GroupUpdateMessage, GroupUpdateMessageParams } from '../GroupUpdateMessage';

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
export class GroupUpdateInviteMessage extends GroupUpdateMessage {
  public readonly groupName: Params['groupName'];
  public readonly adminSignature: Params['adminSignature'];
  public readonly memberAuthData: Params['memberAuthData'];
  private readonly userProfile: Params['userProfile'];
  private readonly proMessageDetails: Params['outgoingProMessageDetails'];

  constructor({
    adminSignature,
    groupName,
    memberAuthData,
    outgoingProMessageDetails,
    userProfile,
    ...others
  }: Params) {
    super({
      ...others,
    });

    this.groupName = groupName; // not sure if getting an invite with an empty group name should make us drop an incoming group invite (and the keys associated to it too)
    this.adminSignature = adminSignature;
    this.memberAuthData = memberAuthData;
    this.proMessageDetails = outgoingProMessageDetails;
    this.userProfile = userProfile;

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

  public dataProto(): SignalService.DataMessage {
    const inviteMessage = new SignalService.GroupUpdateInviteMessage({
      groupSessionId: this.destination,
      name: this.groupName,
      adminSignature: this.adminSignature,
      memberAuthData: this.memberAuthData,
    });

    const ourProfile = this.userProfile?.toProtobufDetails() ?? {};

    return new SignalService.DataMessage({
      ...ourProfile,
      groupUpdateMessage: { inviteMessage },
    });
  }

  public isForGroupSwarm(): boolean {
    return false;
  }

  public isFor1o1Swarm(): boolean {
    return true;
  }

  public lokiProfileProto() {
    return this.userProfile?.toProtobufDetails() ?? {};
  }

  public proMessageProto() {
    return ContentMessage.proMessageProtoFromDetailsOrProto(this.proMessageDetails);
  }
}
