import { SignalService } from '../../../../../../protobuf';
import { SnodeNamespaces } from '../../../../../apis/snode_api/namespaces';
import { GroupUpdateMessage } from '../GroupUpdateMessage';

/**
 * GroupUpdateMemberLeftMessage is sent to the group's swarm.
 * Our pubkey, as the leaving member is part of the encryption of libsession for the new groups
 *
 */
export class GroupUpdateMemberLeftMessage extends GroupUpdateMessage {
  public readonly namespace = SnodeNamespaces.ClosedGroupMessages;

  public dataProto(): SignalService.DataMessage {
    const memberLeftMessage = new SignalService.GroupUpdateMemberLeftMessage({});
    const proto = super.makeDataProto();
    proto.groupUpdateMessage = { memberLeftMessage };
    return proto;
  }

  public isForGroupSwarm(): boolean {
    return true;
  }
  public isFor1o1Swarm(): boolean {
    return false;
  }

  public proMessageProto() {
    return null;
  }

  public lokiProfileProto() {
    return {};
  }
}
