import { SignalService } from '../../../protobuf';
import { TTL_DEFAULT } from '../../constants';
import { Message } from './Message';

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

  public makeContentProto<T extends ContentFields>(extra: T) {
    return new SignalService.Content({
      ...extra,
      sigTimestamp: this.createAtNetworkTimestamp,
    });
  }

  public abstract contentProto(): SignalService.Content;
}
