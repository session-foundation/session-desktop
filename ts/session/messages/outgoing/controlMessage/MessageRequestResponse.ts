import { SignalService } from '../../../../protobuf';
import { type OutgoingUserProfile } from '../../../../types/message';
import type { WithOutgoingProMessageDetails } from '../../../../types/message/OutgoingProMessageDetails';
import { ContentMessage } from '../ContentMessage';
import { MessageParams, type WithOutgoingUserProfile } from '../Message';
import type { OutgoingProMessageDetailsOrProto } from '../visibleMessage/VisibleMessage';

// Note: a MessageRequestResponse message should not expire at all on the recipient side/nor our side.
export type MessageRequestResponseParams = MessageParams &
  WithOutgoingUserProfile &
  WithOutgoingProMessageDetails;

export class MessageRequestResponse extends ContentMessage {
  // Note: we send a response only if it is an accept
  private readonly userProfile: OutgoingUserProfile | null;
  private readonly proMessageDetails: OutgoingProMessageDetailsOrProto | null;

  constructor(params: MessageRequestResponseParams) {
    super({
      createAtNetworkTimestamp: params.createAtNetworkTimestamp,
    } as MessageRequestResponseParams);

    this.userProfile = params.userProfile;
    this.proMessageDetails = params.outgoingProMessageDetails;
  }

  public contentProto(): SignalService.Content {
    // Note: message request responses are not disappearing messages
    return super.makeNonDisappearingContentProto({
      messageRequestResponse: this.messageRequestResponseProto(),
    });
  }

  public messageRequestResponseProto(): SignalService.MessageRequestResponse {
    const protobufDetails = this.userProfile?.toProtobufDetails() ?? {};
    const response = new SignalService.MessageRequestResponse({
      isApproved: true,
      ...protobufDetails,
    });

    return response;
  }

  public lokiProfileProto() {
    return this.userProfile?.toProtobufDetails() ?? {};
  }

  public proMessageProto() {
    return ContentMessage.proMessageProtoFromDetailsOrProto(this.proMessageDetails);
  }
}
