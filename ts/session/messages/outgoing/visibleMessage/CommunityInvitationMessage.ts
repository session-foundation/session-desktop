import { SignalService } from '../../../../protobuf';
import { ContentMessage } from '../ContentMessage';
import { DataMessage } from '../DataMessage';
import { ExpirableMessageParams } from '../ExpirableMessage';
import type { WithOutgoingUserProfile } from '../Message';
import type { WithProMessageDetailsOrProto } from './VisibleMessage';

type CommunityInvitationMessageParams = ExpirableMessageParams &
  WithOutgoingUserProfile &
  WithProMessageDetailsOrProto & {
    url: string;
    name: string;
  };

export class CommunityInvitationMessage extends DataMessage {
  private readonly url: string;
  private readonly name: string;
  private readonly userProfile: CommunityInvitationMessageParams['userProfile'];
  private readonly proMessageDetails: CommunityInvitationMessageParams['outgoingProMessageDetails'];

  constructor(params: CommunityInvitationMessageParams) {
    super({
      createAtNetworkTimestamp: params.createAtNetworkTimestamp,
      identifier: params.identifier,
      expirationType: params.expirationType,
      expireTimer: params.expireTimer,
    });
    this.url = params.url;
    this.name = params.name;
    this.userProfile = params.userProfile;
    this.proMessageDetails = params.outgoingProMessageDetails;
  }

  public dataProto(): SignalService.DataMessage {
    const openGroupInvitation = new SignalService.DataMessage.OpenGroupInvitation({
      url: this.url,
      name: this.name,
    });
    const proto = super.makeDataProto();
    proto.openGroupInvitation = openGroupInvitation;

    return proto;
  }

  public lokiProfileProto() {
    return this.userProfile?.toProtobufDetails() ?? {};
  }

  public proMessageProto() {
    return ContentMessage.proMessageProtoFromDetailsOrProto(this.proMessageDetails);
  }
}
