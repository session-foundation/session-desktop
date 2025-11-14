import { SignalService } from '../../../../../../protobuf';
import { SnodeNamespaces } from '../../../../../apis/snode_api/namespaces';
import { ContentMessage } from '../../../ContentMessage';
import type { WithOutgoingUserProfile } from '../../../Message';
import type { WithProMessageDetailsOrProto } from '../../../visibleMessage/VisibleMessage';
import { GroupUpdateMessage, GroupUpdateMessageParams } from '../GroupUpdateMessage';

type GroupUpdateInviteResponseMessageParams = GroupUpdateMessageParams &
  WithOutgoingUserProfile &
  WithProMessageDetailsOrProto & {
    isApproved: boolean;
  };

/**
 * GroupUpdateInviteResponseMessage is sent to the group's swarm.
 * Our pubkey, as the leaving member is part of the encryption of libsession for the new groups
 *
 */
export class GroupUpdateInviteResponseMessage extends GroupUpdateMessage {
  public readonly isApproved: GroupUpdateInviteResponseMessageParams['isApproved'];
  public readonly namespace = SnodeNamespaces.ClosedGroupMessages;
  private readonly userProfile: GroupUpdateInviteResponseMessageParams['userProfile'];
  private readonly proMessageDetails: GroupUpdateInviteResponseMessageParams['outgoingProMessageDetails'];

  constructor(params: GroupUpdateInviteResponseMessageParams) {
    super(params);
    this.isApproved = params.isApproved;
    this.proMessageDetails = params.outgoingProMessageDetails;
    this.userProfile = params.userProfile;
  }

  public dataProto(): SignalService.DataMessage {
    const inviteResponse = new SignalService.GroupUpdateInviteResponseMessage({
      isApproved: true,
    });

    const ourProfile = this.userProfile?.toProtobufDetails() ?? {};
    return new SignalService.DataMessage({
      ...ourProfile,
      groupUpdateMessage: { inviteResponse },
    });
  }

  public isForGroupSwarm(): boolean {
    return true;
  }
  public isFor1o1Swarm(): boolean {
    return false;
  }

  public lokiProfileProto() {
    return this.userProfile?.toProtobufDetails() ?? {};
  }

  public proMessageProto() {
    return ContentMessage.proMessageProtoFromDetailsOrProto(this.proMessageDetails);
  }
}
