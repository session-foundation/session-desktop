import { SignalService } from '../../../../../../protobuf';
import { SnodeNamespaces } from '../../../../../apis/snode_api/namespaces';
import { GroupUpdateMessage, GroupUpdateMessageParams } from '../GroupUpdateMessage';

type Params = GroupUpdateMessageParams & {
  isApproved: boolean;
};

/**
 * GroupUpdateInviteResponseMessage is sent to the group's swarm.
 * Our pubkey, as the leaving member is part of the encryption of libsession for the new groups
 *
 */
export class GroupUpdateInviteResponseMessage extends GroupUpdateMessage {
  public readonly isApproved: Params['isApproved'];
  public readonly namespace = SnodeNamespaces.ClosedGroupMessages;

  constructor(params: Params) {
    super(params);
    this.isApproved = params.isApproved;
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
}
