import { SignalService } from '../../../../protobuf';
import { type OutgoingUserProfile } from '../../../../types/message';
import { ContentMessage } from '../ContentMessage';
import { MessageParams, type WithOutgoingUserProfile } from '../Message';

// Note: a MessageRequestResponse message should not expire at all on the recipient side/nor our side.
export type MessageRequestResponseParams = MessageParams & WithOutgoingUserProfile;

export class MessageRequestResponse extends ContentMessage {
  // Note: we send a response only if it is an accept
  private readonly userProfile: OutgoingUserProfile | null;

  constructor(params: MessageRequestResponseParams) {
    super({
      createAtNetworkTimestamp: params.createAtNetworkTimestamp,
    } as MessageRequestResponseParams);

    this.userProfile = params.userProfile;
  }

  public contentProto(): SignalService.Content {
    return super.makeContentProto({ messageRequestResponse: this.messageRequestResponseProto() });
  }

  public messageRequestResponseProto(): SignalService.MessageRequestResponse {
    const protobufDetails = this.userProfile?.toProtobufDetails() ?? {};
    const response = new SignalService.MessageRequestResponse({
      isApproved: true,
      ...protobufDetails,
    });

    return response;
  }
}
