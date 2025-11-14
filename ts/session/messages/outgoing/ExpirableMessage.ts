import { SignalService } from '../../../protobuf';
import { DURATION, TTL_DEFAULT } from '../../constants';
import { DisappearingMessageType } from '../../disappearing_messages/types';
import { ContentMessage } from './ContentMessage';
import type { MessageParams } from './Message';

export type ExpirableMessageParams = MessageParams & {
  expirationType: DisappearingMessageType;
  expireTimer: number;
};

export abstract class ExpirableMessage extends ContentMessage {
  public readonly expirationType: DisappearingMessageType;
  /** in seconds, 0 means no expiration */
  public readonly expireTimer: number;

  constructor(params: ExpirableMessageParams) {
    super({
      createAtNetworkTimestamp: params.createAtNetworkTimestamp,
      identifier: params.identifier,
    });
    this.expirationType = params.expirationType;
    this.expireTimer = params.expireTimer;
  }

  public makeDisappearingContentProto(): SignalService.Content {
    return super.makeNonDisappearingContentProto({
      expirationType:
        this.expirationType === 'deleteAfterSend'
          ? SignalService.Content.ExpirationType.DELETE_AFTER_SEND
          : this.expirationType === 'deleteAfterRead'
            ? SignalService.Content.ExpirationType.DELETE_AFTER_READ
            : SignalService.Content.ExpirationType.UNKNOWN,
      expirationTimer: this.expireTimer >= 0 ? this.expireTimer : undefined,
    });
  }

  public getDisappearingMessageType(): DisappearingMessageType | undefined {
    return this.expirationType || undefined;
  }

  public ttl(): number {
    switch (this.expirationType) {
      case 'deleteAfterSend':
        return this.expireTimer ? this.expireTimer * DURATION.SECONDS : TTL_DEFAULT.CONTENT_MESSAGE;
      case 'deleteAfterRead':
        return TTL_DEFAULT.CONTENT_MESSAGE;
      default:
        return TTL_DEFAULT.CONTENT_MESSAGE;
    }
  }
}
