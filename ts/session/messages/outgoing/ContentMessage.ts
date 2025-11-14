import { SignalService } from '../../../protobuf';
import { OutgoingProMessageDetails } from '../../../types/message/OutgoingProMessageDetails';
import { TTL_DEFAULT } from '../../constants';
import { Message } from './Message';
import type { OutgoingProMessageDetailsOrProto } from './visibleMessage/VisibleMessage';

type InstanceFields<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof T as T[K] extends Function ? never : K]: T[K];
};

type ContentFields = Partial<Omit<InstanceFields<SignalService.Content>, 'sigTimestamp'>>;

export abstract class ContentMessage extends Message {
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

  public makeNonDisappearingContentProto<T extends ContentFields>(extra: T) {
    return new SignalService.Content({
      ...extra,
      sigTimestamp: this.createAtNetworkTimestamp,
    });
  }

  public abstract contentProto(): SignalService.Content;

  public abstract proMessageProto(): SignalService.ProMessage | null;
  public abstract lokiProfileProto(): Partial<
    Pick<SignalService.DataMessage, 'profile' | 'profileKey'>
  >;

  /**
   * Utility function to convert the OutgoingProMessageDetailsOrProto to a SignalService.ProMessage
   * depending on what is provided.
   * This is just to avoid duplicating this code in all the message types that need it.
   */
  public static proMessageProtoFromDetailsOrProto(
    detailsOrProto: OutgoingProMessageDetailsOrProto
  ): SignalService.ProMessage | null {
    if (detailsOrProto instanceof OutgoingProMessageDetails) {
      return detailsOrProto.toProtobufDetails();
    }
    return detailsOrProto;
  }
}
