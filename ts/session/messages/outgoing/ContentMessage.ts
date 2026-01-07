import { SignalService } from '../../../protobuf';
import type { OutgoingUserProfile } from '../../../types/message';
import { OutgoingProMessageDetails } from '../../../types/message/OutgoingProMessageDetails';
import { TTL_DEFAULT } from '../../constants';
import { Message, type MessageParams, type WithOutgoingUserProfile } from './Message';
import type {
  OutgoingProMessageDetailsOrProto,
  WithProMessageDetailsOrProto,
} from './visibleMessage/VisibleMessage';

export abstract class ContentMessageNoProfile extends Message {
  public plainTextBuffer(): Uint8Array {
    const contentProto = this.contentProto();
    if (!contentProto.sigTimestamp) {
      throw new Error('trying to build a ContentMessage without a sig timestamp is unsupported');
    }

    return SignalService.Content.encode(contentProto).finish();
  }

  public ttl(): number {
    return TTL_DEFAULT.CONTENT_MESSAGE;
  }

  protected makeNonDisappearingContentProto() {
    return new SignalService.Content({
      sigTimestamp: this.createAtNetworkTimestamp,
    });
  }

  public abstract contentProto(): SignalService.Content;
}

export abstract class ContentMessageWithProfile extends ContentMessageNoProfile {
  private readonly userProfile: OutgoingUserProfile | null;
  private readonly proMessageDetails: OutgoingProMessageDetailsOrProto;

  constructor(params: MessageParams & WithOutgoingUserProfile & WithProMessageDetailsOrProto) {
    super(params);

    this.userProfile = params.userProfile;
    this.proMessageDetails = params.outgoingProMessageDetails;
  }

  protected makeNonDisappearingContentProto(): SignalService.Content {
    window.log.warn(
      'makeNonDisappearingContentProto cannot be called directly on a `ContentMessageWithProfile`.'
    );
    window.log.warn(
      'You probably want to use makeNonDisappearingContentProtoWithPro, or inherit from`ContentMessageNoProfile` instead.'
    );
    throw new Error(
      'makeNonDisappearingContentProto cannot be called directly on a `ContentMessageWithProfile.`'
    );
  }

  protected makeNonDisappearingContentProtoWithPro() {
    const content = super.makeNonDisappearingContentProto();
    content.proMessage = this.proMessageProto();

    return content;
  }

  private proMessageProto(): SignalService.ProMessage | null {
    return proMessageProtoFromDetailsOrProto(this.proMessageDetails);
  }

  /**
   * Returns the profile details as a protobuf object to include for this message.
   * `protected` as this needs to be set in the dataProto() or messageRequestResponse() calls.
   */
  protected lokiProfileProto(): Partial<Pick<SignalService.DataMessage, 'profile' | 'profileKey'>> {
    return this.userProfile?.toProtobufDetails() ?? {};
  }
}

/**
 * Utility function to convert the OutgoingProMessageDetailsOrProto to a SignalService.ProMessage
 * depending on what is provided.
 * This is just to avoid duplicating this code in all the message types that need it.
 */
function proMessageProtoFromDetailsOrProto(
  detailsOrProto: OutgoingProMessageDetailsOrProto
): SignalService.ProMessage | null {
  if (detailsOrProto instanceof OutgoingProMessageDetails) {
    return detailsOrProto.toProtobufDetails();
  }
  return detailsOrProto;
}
