import { SignalService } from '../../../../protobuf';
import type { WithOutgoingProMessageDetails } from '../../../../types/message/OutgoingProMessageDetails';
import { ContentMessageWithProfile } from '../ContentMessage';
import { MessageParams, type WithOutgoingUserProfile } from '../Message';

// Note: a MessageRequestResponse message should not expire at all on the recipient side/nor our side.
export type MessageRequestResponseParams = MessageParams &
  WithOutgoingUserProfile &
  WithOutgoingProMessageDetails;

export class MessageRequestResponse extends ContentMessageWithProfile {
  constructor(params: MessageRequestResponseParams) {
    super({
      createAtNetworkTimestamp: params.createAtNetworkTimestamp,
      outgoingProMessageDetails: params.outgoingProMessageDetails,
      userProfile: params.userProfile,
    });
  }

  public override contentProto(): SignalService.Content {
    // Note: message request responses are not disappearing messages
    const content = super.makeNonDisappearingContentProtoWithPro();
    content.messageRequestResponse = this.messageRequestResponseProto();
    return content;
  }

  public messageRequestResponseProto(): SignalService.MessageRequestResponse {
    const protobufDetails = this.lokiProfileProto();
    const response = new SignalService.MessageRequestResponse({
      isApproved: true,
      ...protobufDetails,
    });

    return response;
  }
}
