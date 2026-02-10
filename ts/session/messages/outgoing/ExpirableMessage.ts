/* eslint-disable no-param-reassign */
import { SignalService } from '../../../protobuf';
import { DURATION, TTL_DEFAULT } from '../../constants';
import { DisappearingMessageType } from '../../disappearing_messages/types';
import { ContentMessageNoProfile, ContentMessageWithProfile } from './ContentMessage';
import type { MessageParams, WithOutgoingUserProfile } from './Message';
import type { WithProMessageDetailsOrProto } from './visibleMessage/VisibleMessage';

export type ExpirableMessageParams = MessageParams & {
  expirationType: DisappearingMessageType;
  expireTimer: number;
};

function ttlForExpirationType(
  expirationType: DisappearingMessageType,
  expireTimerSeconds: number
): number {
  switch (expirationType) {
    case 'deleteAfterSend':
      return expireTimerSeconds
        ? expireTimerSeconds * DURATION.SECONDS
        : TTL_DEFAULT.CONTENT_MESSAGE;
    case 'deleteAfterRead':
      return TTL_DEFAULT.CONTENT_MESSAGE;
    default:
      return TTL_DEFAULT.CONTENT_MESSAGE;
  }
}

function addDisappearingContentProto(
  content: SignalService.Content,
  expirationType: DisappearingMessageType,
  expireTimerSeconds: number
) {
  content.expirationType =
    expirationType === 'deleteAfterSend'
      ? SignalService.Content.ExpirationType.DELETE_AFTER_SEND
      : expirationType === 'deleteAfterRead'
        ? SignalService.Content.ExpirationType.DELETE_AFTER_READ
        : SignalService.Content.ExpirationType.UNKNOWN;

  if (expireTimerSeconds >= 0) {
    content.expirationTimer = expireTimerSeconds;
  }
}

export abstract class ExpirableMessageNoProfile extends ContentMessageNoProfile {
  public readonly expirationType: DisappearingMessageType;
  /** in seconds, 0 means no expiration */
  public readonly expireTimerSeconds: number;

  constructor(params: ExpirableMessageParams) {
    super({
      createAtNetworkTimestamp: params.createAtNetworkTimestamp,
      dbMessageIdentifier: params.dbMessageIdentifier,
    });
    this.expirationType = params.expirationType;
    this.expireTimerSeconds = params.expireTimer;
  }

  public makeDisappearingContentProto(): SignalService.Content {
    const content = super.makeNonDisappearingContentProto();
    addDisappearingContentProto(content, this.expirationType, this.expireTimerSeconds);
    return content;
  }

  public getDisappearingMessageType(): DisappearingMessageType | undefined {
    return this.expirationType;
  }

  public ttl(): number {
    return ttlForExpirationType(this.expirationType, this.expireTimerSeconds);
  }
}

export abstract class ExpirableMessageWithProfile extends ContentMessageWithProfile {
  public readonly expirationType: DisappearingMessageType;
  /** in seconds, 0 means no expiration */
  public readonly expireTimerSeconds: number;

  constructor(
    params: ExpirableMessageParams & WithOutgoingUserProfile & WithProMessageDetailsOrProto
  ) {
    super({
      createAtNetworkTimestamp: params.createAtNetworkTimestamp,
      dbMessageIdentifier: params.dbMessageIdentifier,
      userProfile: params.userProfile,
      outgoingProMessageDetails: params.outgoingProMessageDetails,
    });
    this.expirationType = params.expirationType;
    this.expireTimerSeconds = params.expireTimer;
  }

  public makeDisappearingContentProto(): SignalService.Content {
    const content = super.makeNonDisappearingContentProtoWithPro();
    addDisappearingContentProto(content, this.expirationType, this.expireTimerSeconds);
    return content;
  }

  public getDisappearingMessageType(): DisappearingMessageType | undefined {
    return this.expirationType;
  }

  public ttl(): number {
    return ttlForExpirationType(this.expirationType, this.expireTimerSeconds);
  }
}
