import { SignalService } from '../../../../../../protobuf';
import { SnodeNamespaces } from '../../../../../apis/snode_api/namespaces';
import { GroupUpdateMessageNoProfile } from '../GroupUpdateMessage';

/**
 * GroupUpdateMemberLeftMessage is sent to the group's swarm.
 * Our pubkey, as the leaving member is part of the encryption of libsession for the new groups
 *
 */
export class GroupUpdateMemberLeftMessage extends GroupUpdateMessageNoProfile {
  public readonly namespace = SnodeNamespaces.ClosedGroupMessages;

  public override dataProto(): SignalService.DataMessage {
    const memberLeftMessage = new SignalService.GroupUpdateMemberLeftMessage({});
    const proto = super.makeDataProtoNoProfile();
    proto.groupUpdateMessage = { memberLeftMessage };
    return proto;
  }
}
