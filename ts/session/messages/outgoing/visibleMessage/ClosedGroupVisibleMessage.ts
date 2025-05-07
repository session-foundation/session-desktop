import { GroupPubkeyType } from 'libsession_util_nodejs';
import { SignalService } from '../../../../protobuf';
import { SnodeNamespaces } from '../../../apis/snode_api/namespaces';
import { PubKey } from '../../../types';
import { DataMessage } from '../DataMessage';

import { VisibleMessage } from './VisibleMessage';
import type { ExpirableMessageParams } from '../ExpirableMessage';

interface ClosedGroupMessageParams extends ExpirableMessageParams {
  groupId: string | PubKey;
}

interface ClosedGroupVisibleMessageParams
  extends Omit<
    ClosedGroupMessageParams,
    'expireTimer' | 'expirationType' | 'identifier' | 'createAtNetworkTimestamp'
  > {
  groupId: string;
  chatMessage: VisibleMessage;
}

type WithDestinationGroupPk = { destination: GroupPubkeyType };

export class ClosedGroupV2VisibleMessage extends DataMessage {
  private readonly chatMessage: VisibleMessage;
  public readonly destination: GroupPubkeyType;
  public readonly namespace = SnodeNamespaces.ClosedGroupMessages;

  constructor(
    params: Pick<ClosedGroupVisibleMessageParams, 'chatMessage'> & WithDestinationGroupPk
  ) {
    super(params.chatMessage);
    this.chatMessage = params.chatMessage;
    if (
      this.chatMessage.expirationType !== 'deleteAfterSend' &&
      this.chatMessage.expirationType !== 'unknown'
    ) {
      throw new Error('groupv2 message only support DaS and off Disappearing options');
    }

    if (!PubKey.is03Pubkey(params.destination)) {
      throw new Error('ClosedGroupV2VisibleMessage only work with 03-groups destination');
    }
    this.destination = params.destination;
  }

  public dataProto(): SignalService.DataMessage {
    // expireTimer is set in the dataProto in this call directly
    const dataProto = this.chatMessage.dataProto();
    return dataProto;
  }
}
