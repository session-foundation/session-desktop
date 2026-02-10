import { GroupPubkeyType } from 'libsession_util_nodejs';
import { SignalService } from '../../../../protobuf';
import { SnodeNamespaces } from '../../../apis/snode_api/namespaces';
import { PubKey } from '../../../types';
import { DataMessageWithProfile } from '../DataMessage';

import { VisibleMessage, type VisibleMessageParams } from './VisibleMessage';
import type { ExpirableMessageParams } from '../ExpirableMessage';

type ClosedGroupMessageParams = ExpirableMessageParams & {
  groupId: string | PubKey;
};

interface ClosedGroupVisibleMessageParams
  extends Omit<
    ClosedGroupMessageParams,
    'expireTimer' | 'expirationType' | 'dbMessageIdentifier' | 'createAtNetworkTimestamp'
  > {
  groupId: string;
  chatMessageParams: VisibleMessageParams;
}

type WithDestinationGroupPk = { destination: GroupPubkeyType };

export class ClosedGroupV2VisibleMessage extends DataMessageWithProfile {
  private readonly chatMessageParams: VisibleMessageParams;
  public readonly destination: GroupPubkeyType;
  public readonly namespace = SnodeNamespaces.ClosedGroupMessages;
  private readonly chatMessage: VisibleMessage;

  constructor(
    params: Pick<ClosedGroupVisibleMessageParams, 'chatMessageParams'> & WithDestinationGroupPk
  ) {
    super(params.chatMessageParams);
    this.chatMessageParams = params.chatMessageParams;
    if (
      this.chatMessageParams.expirationType !== 'deleteAfterSend' &&
      this.chatMessageParams.expirationType !== 'unknown'
    ) {
      throw new Error('groupv2 message only support DaS and off Disappearing options');
    }
    this.chatMessage = new VisibleMessage(this.chatMessageParams);

    if (!PubKey.is03Pubkey(params.destination)) {
      throw new Error('ClosedGroupV2VisibleMessage only work with 03-groups destination');
    }
    this.destination = params.destination;
  }

  public override dataProto(): SignalService.DataMessage {
    // expireTimer is set in the dataProto in this call directly
    const dataProto = this.chatMessage.dataProto();
    return dataProto;
  }
}
