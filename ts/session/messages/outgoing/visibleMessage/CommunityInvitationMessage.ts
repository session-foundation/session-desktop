import { SignalService } from '../../../../protobuf';
import { DataMessageWithProfile } from '../DataMessage';
import { ExpirableMessageParams } from '../ExpirableMessage';
import type { WithOutgoingUserProfile } from '../Message';
import type { WithProMessageDetailsOrProto } from './VisibleMessage';

type CommunityInvitationMessageParams = ExpirableMessageParams &
  WithOutgoingUserProfile &
  WithProMessageDetailsOrProto & {
    url: string;
    name: string;
  };

export class CommunityInvitationMessage extends DataMessageWithProfile {
  private readonly url: string;
  private readonly name: string;

  constructor(params: CommunityInvitationMessageParams) {
    super({
      createAtNetworkTimestamp: params.createAtNetworkTimestamp,
      dbMessageIdentifier: params.dbMessageIdentifier,
      expirationType: params.expirationType,
      expireTimer: params.expireTimer,
      outgoingProMessageDetails: params.outgoingProMessageDetails,
      userProfile: params.userProfile,
    });
    this.url = params.url;
    this.name = params.name;
  }

  public override dataProto(): SignalService.DataMessage {
    const openGroupInvitation = new SignalService.DataMessage.OpenGroupInvitation({
      url: this.url,
      name: this.name,
    });
    const proto = super.makeDataProtoWithProfile();
    proto.openGroupInvitation = openGroupInvitation;

    return proto;
  }
}
