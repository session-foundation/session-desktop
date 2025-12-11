import { SignalService } from '../../../../../../protobuf';
import { SnodeNamespaces } from '../../../../../apis/snode_api/namespaces';
import type { WithOutgoingUserProfile } from '../../../Message';
import type { WithProMessageDetailsOrProto } from '../../../visibleMessage/VisibleMessage';
import { GroupUpdateMessageParams, GroupUpdateMessageWithProfile } from '../GroupUpdateMessage';

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
export class GroupUpdateInviteResponseMessage extends GroupUpdateMessageWithProfile {
  public readonly isApproved: GroupUpdateInviteResponseMessageParams['isApproved'];
  public readonly namespace = SnodeNamespaces.ClosedGroupMessages;

  constructor(params: GroupUpdateInviteResponseMessageParams) {
    super(params);
    this.isApproved = params.isApproved;
  }

  public override dataProto(): SignalService.DataMessage {
    const inviteResponse = new SignalService.GroupUpdateInviteResponseMessage({
      isApproved: true,
    });

    const proto = super.makeDataProtoWithProfile();
    proto.groupUpdateMessage = { inviteResponse };
    return proto;
  }
}
