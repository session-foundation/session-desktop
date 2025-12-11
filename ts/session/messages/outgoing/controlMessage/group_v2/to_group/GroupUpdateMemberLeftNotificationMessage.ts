import { SignalService } from '../../../../../../protobuf';
import { SnodeNamespaces } from '../../../../../apis/snode_api/namespaces';
import { GroupUpdateMessageNoProfile } from '../GroupUpdateMessage';

/**
 * GroupUpdateMemberLeftNotificationMessage is sent to the group's swarm.
 * Our pubkey, as the leaving member is part of the encryption of libsession for the new groups
 *
 */
export class GroupUpdateMemberLeftNotificationMessage extends GroupUpdateMessageNoProfile {
  public readonly namespace = SnodeNamespaces.ClosedGroupMessages;

  public override dataProto(): SignalService.DataMessage {
    const memberLeftNotificationMessage =
      new SignalService.GroupUpdateMemberLeftNotificationMessage({});

    const proto = super.makeDataProtoNoProfile();
    proto.groupUpdateMessage = { memberLeftNotificationMessage };
    return proto;
  }
}
