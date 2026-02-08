import type { OutgoingUserProfile } from '../../../types/message';

export type MessageParams = {
  createAtNetworkTimestamp: number;
  /**
   * Every message we build needs an identifier.
   * It can either be a valid message stored in the DB or a random uuid v4 created just for the purpose of sending that message.
   */
  dbMessageIdentifier: string;
};

export type WithOutgoingUserProfile = { userProfile: OutgoingUserProfile | null };

export abstract class Message {
  /**
   * This is the network timestamp when this message was created (and so, potentially signed).
   * This must be used as the envelope timestamp, as other devices are going to use it to verify messages.
   * There is also the stored_at/effectiveTimestamp which we get back once we sent a message to the recipient's swarm, but that's not included here.
   */
  public readonly createAtNetworkTimestamp: number;
  public readonly dbMessageIdentifier: string;

  constructor({ createAtNetworkTimestamp, dbMessageIdentifier }: MessageParams) {
    this.createAtNetworkTimestamp = createAtNetworkTimestamp;

    if (!createAtNetworkTimestamp || createAtNetworkTimestamp <= 0) {
      throw new Error('Cannot set undefined createAtNetworkTimestamp or <=0');
    }

    if (!dbMessageIdentifier) {
      throw new Error('Every message needs an non-empty dbMessageIdentifier');
    }
    this.dbMessageIdentifier = dbMessageIdentifier;
  }
}
